import { BanksClient, ProgramTestContext, startAnchor } from "solana-bankrun";
// @ts-ignore
import IDL from "../target/idl/lending.json";
import { Lending } from "../target/types/lending";
import {describe, it} from "node:test";
import { PublicKey,Connection } from "@solana/web3.js";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { BankrunProvider } from "anchor-bankrun";
import { BankrunContextWrapper } from "../bankrun-utils/bankrunConnection";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { createAccount, createMint, mintTo } from 'spl-token-bankrun';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";



describe("Lending Smart Contract test suite", async () => {
    // Environment setup
    // This is the context that will be used to interact with the smart contract
    // Lending Program and Pyth account deployed
    // Setup to fetch price feed account
    let context: ProgramTestContext;
    let provider: BankrunProvider;
    let bankrunContextWrapper: BankrunContextWrapper;
    
    const pyth = new PublicKey('7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE');
    const devnetConnection = new Connection("https://api.devnet.solana.com");
    const accountInfo = await devnetConnection.getAccountInfo(pyth);
    let program: Program<Lending>;
    let banksClient: BanksClient;
    let signer: Keypair;
    let usdcBankAccount: PublicKey;
    let solBankAccount: PublicKey;
    context = await startAnchor(
        "",
        [{name:"lending", programId: new PublicKey(IDL.address)}], // programs
        [{address: pyth, info: accountInfo}], // accounts
    );
    provider = new BankrunProvider(context)
    bankrunContextWrapper = new BankrunContextWrapper(context);

    const connection = bankrunContextWrapper.connection.toConnection();
  
    const pythSolanaReceiver = new PythSolanaReceiver({
      connection,
      wallet: provider.wallet,
    });
    const SOL_PRICE_FEED_ID = "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"
    const solUsdPriceFeedAccount = pythSolanaReceiver.getPriceFeedAccountAddress(0, SOL_PRICE_FEED_ID);
    console.log("SOL Price Feed Account: ", solUsdPriceFeedAccount);
    const feedAccountInfo = await devnetConnection.getAccountInfo(solUsdPriceFeedAccount);
    console.log("feedAccountInfo: ", feedAccountInfo);

    context.setAccount(solUsdPriceFeedAccount, feedAccountInfo);
    program = new Program<Lending>(IDL as Lending, provider);
    banksClient = context.banksClient;
    signer = provider.wallet.payer;

    // Minting Dummy tokens act as USDC and SOL
    const mintUSDC = await createMint(
        banksClient,// banks client
        signer, // payer
        signer.publicKey,// mint authority
        null, // freeze authority
        2 // decimals
      );
      console.log("Mint USDC: ", mintUSDC);
    
      const mintSOL = await createMint(
        banksClient,
        signer,
        signer.publicKey,
        null,
        2
      );
        console.log("Mint SOL: ", mintSOL);
        console.log("signer : ",signer.publicKey);
        console.log("mintUSDC : ",mintUSDC);
        console.log("TOKEN PROGRAM ID : ",TOKEN_PROGRAM_ID);

      [solBankAccount]=PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"),mintSOL.toBuffer()],
        program.programId
      );

      [usdcBankAccount]=PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"),mintUSDC.toBuffer()],
        program.programId
      );

     it("Test init and Fund USDC Bank", async () => {
        const initUSDCBankTx = await program.methods.initBank(new BN(1),new BN(1)).accounts({
            signer:signer.publicKey,
            mint: mintUSDC,
            tokenProgram: TOKEN_PROGRAM_ID,
        }).rpc({commitment: "confirmed"});
        console.log("Create USDC Bank Account: ", initUSDCBankTx);
        
        const amount = 10_000*10**9;
        const mintTx = await mintTo(
            banksClient,
            signer,
            mintUSDC,
            usdcBankAccount,
            signer,
            amount
          );
        console.log("Mint USDC to Bank: ", mintTx);
     });

     it("Test Init User", async () => {
        const initUserTx = await program.methods.initUser(mintUSDC).accounts({
            signer:signer.publicKey,
        }).rpc({commitment: "confirmed"});
        console.log("Init User: ", initUserTx);
     })
     it("Test Init and Fund Sol Bank", async () => {
        const initSolBankTx = await program.methods.initBank(new BN(2),new BN(1)).accounts({
            signer:signer.publicKey,
            mint: mintSOL,
            tokenProgram: TOKEN_PROGRAM_ID,
        }).rpc({commitment: "confirmed"});
        console.log("Create SOL Bank Account: ", initSolBankTx);
        
        const amount = 10_000*10**9;
        const mintTx = await mintTo(
            banksClient,
            signer,
            mintSOL,
            solBankAccount,
            signer,
            amount
          );
        console.log("Mint SOL to Bank: ", mintTx);
     });
        
     it("Create and Fund Token Accounts", async () => {
        const USDCTokenAccount = await createAccount(
            banksClient,
            signer,
            mintUSDC,
            signer.publicKey
        );
        console.log("USDC Token Account: ", USDCTokenAccount);
        const amount = 10_000*10**9;
        const mintUSDCTx = await mintTo(
            banksClient,
            signer,
            mintUSDC,
            USDCTokenAccount,
            signer,
            amount
          );
        console.log("Mint USDC to Token Account: ", mintUSDCTx);
        
     })

        it("Test Deposit", async () => {
        const depositUSDC = await program.methods
        .deposit(new BN(10_000*10**9))
        .accounts({
            signer:signer.publicKey,
            mint: mintUSDC,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({commitment: "confirmed"});
        console.log("Deposit USDC: ", depositUSDC);
     })

        it("Test Borrow", async () => {
        const borrowSol = await program.methods
        .borrow(new BN(1))
        .accounts({
            signer:signer.publicKey,
            mint: mintSOL,
            tokenProgram: TOKEN_PROGRAM_ID,
            priceUpdate: solUsdPriceFeedAccount,
        })
        .rpc({commitment: "confirmed"});
        console.log("Borrow SOL: ", borrowSol);
     })

        it("Test Repay", async () => {
        const repaySol = await program.methods
        .repay(new BN(1))
        .accounts({
            signer:signer.publicKey,
            mint: mintSOL,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({commitment: "confirmed"});
        console.log("Repay SOL: ", repaySol);
     })

        it("Test Withdraw", async () => {
            const withdrawUSDC = await program.methods
            .withdraw(new BN(100))
            .accounts({
                signer:signer.publicKey,
                mint: mintUSDC,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc({commitment: "confirmed"});
            console.log("Withdraw USDC: ", withdrawUSDC);
        })



})
