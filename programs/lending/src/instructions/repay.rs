use std::f32::consts::E;

use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{self,Mint, TokenAccount, TokenInterface, TransferChecked}};
use crate::state::Bank;
use crate::state::User;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Repay<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        seeds = [mint.key().as_ref()],
        bump,
    )]
    pub bank: Account<'info, Bank>,
    #[account(
        mut,
        seeds = [b"treasury", mint.key().as_ref()],
        bump,
    )]
    pub bank_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [signer.key().as_ref()],
        bump,
    )]
    pub user_account: Account<'info, User>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = signer,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program : Program<'info, AssociatedToken>,

}

pub fn process_repay(ctx: Context<Repay>, amount:u64) -> Result<()>{
    let user = &mut ctx.accounts.user_account;
    let borrowed_value:u64;

    match ctx.accounts.mint.to_account_info().key() {
        key if key == user.usdc_address => {
            borrowed_value = user.borrowed_usdc;
        },
        _ => {
            borrowed_value = user.borrowed_sol;
        }
    }
    let bank = &mut ctx.accounts.bank;
    // msg!("Borrowed Value: {}", borrowed_value);    
    // let time_diff = user.last_updated_borrowed - Clock::get()?.unix_timestamp;
    // msg!("bank.total_borrowed 1: {}", bank.total_borrowed);
    // msg!("time_diff: {}", time_diff);
    // bank.total_borrowed -= (bank.total_borrowed as f64 * E.powf(bank.interest_rate as f32 * time_diff as f32) as f64) as u64;
  
    // msg!("bank.total_borrowed 2: {}", bank.total_borrowed);    
    // let value_per_share = bank.total_borrowed / bank.total_borrowed_shares as u64;
    // msg!("value_per_share: {}", value_per_share);    
   
    // let user_value = borrowed_value / value_per_share;

    if amount > borrowed_value {
        return Err(ErrorCode::OverRepay.into());
    }
    let transfer_cpi_accounts = TransferChecked {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.bank_token_account.to_account_info(),
        authority: ctx.accounts.signer.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, transfer_cpi_accounts);
    let decimals = ctx.accounts.mint.decimals;
    token_interface::transfer_checked(cpi_ctx, amount, decimals)?;
    let borrowed_ratio = amount.checked_div(bank.total_borrowed).unwrap();
    let user_shares = bank.total_borrowed_shares.checked_mul(borrowed_ratio).unwrap();

    match ctx.accounts.mint.to_account_info().key() {
        key if key == user.usdc_address => {
            user.borrowed_usdc -= amount;
            user.borrowed_usdc_shares -= user_shares;
        },
        _ => {
            user.borrowed_sol -= amount;
            user.borrowed_sol_shares -= user_shares;
        }
    }
    bank.total_borrowed -= amount;
    bank.total_borrowed_shares -= user_shares;
    
    Ok(())
}