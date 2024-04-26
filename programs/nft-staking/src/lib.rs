use anchor_lang::prelude::*;
use anchor_spl::token::{mint_to, MintTo, Mint, TokenAccount, Token};
use anchor_spl::associated_token::AssociatedToken;
declare_id!("E51uGYbVrPyLffi5qVgjxvYaaRA1StrJjqq3J7HnSpCV");

#[program]
pub mod nft_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Token state initialized");
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>) -> Result<()> {
        // make pda for nft collection
        // transfer nft to pda
        Ok(())
    }
    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        // transfer nft from pda
        // close pda
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [b"mint"],
        bump,
        payer = user,
        mint::decimals = 6,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct Stake {

}

#[derive(Accounts)]
pub struct Unstake {

}


#[error_code]
enum StakingError {
    #[msg("User does not own nft")]
    NotOwner
}