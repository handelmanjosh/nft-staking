use anchor_lang::prelude::*;
use anchor_spl::token::{mint_to, MintTo, Mint, TokenAccount, Token, transfer, Transfer};
use anchor_spl::associated_token::AssociatedToken;
declare_id!("E51uGYbVrPyLffi5qVgjxvYaaRA1StrJjqq3J7HnSpCV");

#[program]
pub mod nft_staking {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("Token state initialized");
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>) -> Result<()> {
        // make pda for nft collection
        // transfer nft to pda
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.nft_account.to_account_info(),
                    to: ctx.accounts.stake_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                }
            ),
            1
        )?; // remember to add error handling
        let staking_account = &mut ctx.accounts.stake_account;
        staking_account.staked_time = Clock::get()?.unix_timestamp;
        staking_account.owner = ctx.accounts.user.key();
        staking_account.mint = ctx.accounts.nft_account.mint;
        Ok(())
    }
    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        // transfer nft from pda
        // close pda
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.stake_token_account.to_account_info(),
                    to: ctx.accounts.nft_account.to_account_info(),
                    authority: ctx.accounts.program_authority.to_account_info(),
                },
                &[&[b"stake_account"]]
            ),
            1
        );
        let time_diff = Clock::get()?.unix_timestamp - ctx.accounts.stake_account.staked_time;
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    to: ctx.accounts.user_token_account.to_account_info(),
                    mint: ctx.accounts.token_mint.to_account_info(),
                    authority: ctx.accounts.token_mint.to_account_info(),
                },
                &[&[b"mint"]]
            ),
            10*10^6
        );
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
    #[account(
        init,
        seeds = [b"auth"],
        bump,
        payer = user,
        space = 8
    )]
    /// CHECK: fuck off
    pub program_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct StakeInfo {
    owner: Pubkey,
    mint: Pubkey,
    staked_time: i64,
}
#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(
        init,
        seeds = [b"stake", user.key().as_ref(), nft_account.key().as_ref()],
        bump,
        payer = user,
        space = 8 + 32 + 32 + 8,
    )]
    pub stake_account: Account<'info, StakeInfo>,
    #[account(
        init,
        seeds = [b"stake_account", user.key().as_ref(), nft_account.key().as_ref()],
        bump,
        payer = user,
        token::mint = mint,
        token::authority = program_authority,
    )]
    pub stake_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub nft_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    #[account(
        seeds = [b"auth"],
        bump
    )]
    /// CHECK: fuck off
    pub program_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref(), nft_account.key().as_ref()],
        bump,
        close = user,
    )]
    pub stake_account: Account<'info, StakeInfo>,
    #[account(
        mut,
        seeds = [b"stake_account", user.key().as_ref(), nft_account.key().as_ref()],
        bump,
        close = user,
    )]
    pub stake_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub nft_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    #[account(
        seeds = [b"mint"],
        bump,
    )]
    pub token_mint: Account<'info, Mint>,
    #[account(
        seeds = [b"auth"],
        bump,
    )]
    /// CHECK: fuck off
    pub program_authority: AccountInfo<'info>,
}
