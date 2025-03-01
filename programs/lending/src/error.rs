use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Withdrawal amount exceeds deposited funds")]
    InsufficientFunds,
    #[msg("Borrow amount exceeds limit")]
    BorrowAmountExceedsLimit,
    #[msg("Repay amount exceeds borrowed funds")]
    OverRepay,  
    #[msg("User is not under collateralized, cant be liquidated")]
    NotUnderCollateralized,
}
