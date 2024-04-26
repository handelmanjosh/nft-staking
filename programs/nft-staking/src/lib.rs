use anchor_lang::prelude::*;

declare_id!("E51uGYbVrPyLffi5qVgjxvYaaRA1StrJjqq3J7HnSpCV");

#[program]
pub mod nft_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>) -> Result<()> {
        Ok(())
    }
    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct Stake {}

#[derive(Accounts)]
pub struct Unstake {}
