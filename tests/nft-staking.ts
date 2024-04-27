import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } from "@solana/spl-token";
import { assert } from "chai";
describe("nft-staking", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.NftStaking as Program<NftStaking>;

  const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    program.programId,
  );
  const [programAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("auth")],
    program.programId,
  );
  const initialize = async () => {
    const tx = await program.methods.initialize().accounts({
      mint,
      programAuthority,
    }).rpc();
  }
  it("Is initialized!", async () => {
    // Add your test here.
    await initialize();
  });
  
  const stake = async () => {
    const nftMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      0
    );
    const nftAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      nftMint,
      wallet.publicKey,
    );
    await mintTo(
      provider.connection,
      wallet.payer,
      nftMint,
      nftAccount.address,
      wallet.payer,
      1
    );
    const [stakeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), wallet.publicKey.toBuffer(), nftAccount.address.toBuffer()],
      program.programId,
    );
    const [stakeTokenAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake_account"), wallet.publicKey.toBuffer(), nftAccount.address.toBuffer()],
      program.programId,
    )
    await program.methods.stake().accounts({
      stakeAccount,
      stakeTokenAccount,
      user: wallet.publicKey,
      mint: nftMint,
      programAuthority,
      nftAccount: nftAccount.address,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([wallet.payer]).rpc();
    const fetched = await program.account.stakeInfo.fetch(stakeAccount);

    assert(fetched.mint.toString() == nftMint.toString());
    assert(fetched.owner.toString() == wallet.publicKey.toString());
    assert(fetched.stakedTime.toNumber() > 0);
    const stakedTokenAccount = await getAccount(
      provider.connection,
      stakeTokenAccount
    );
    assert(stakedTokenAccount.amount == BigInt(1), "Token account does not contain token");
    let nft = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      nftMint,
      wallet.publicKey,
    );
    assert(nft.amount == BigInt(0), "Token not transferred");
    return { nftMint, nftAccount, stakeTokenAccount, stakeAccount }
  }
  it("can stake nft", async () => {
    // create nft collection for testing
    await stake();
  });
  it("can claim rewards", async () => {
    const { nftMint, nftAccount, stakeTokenAccount, stakeAccount } = await stake();
    const stakeAccountBefore = await program.account.stakeInfo.fetch(stakeAccount);
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      wallet.publicKey,
    );
    await program.methods.claim().accounts({
      stakeAccount,
      user: wallet.publicKey,
      userTokenAccount: userTokenAccount.address,
      nftAccount: nftAccount.address,
      tokenMint: mint,
    }).signers([wallet.payer]).rpc();
    const nft = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      nftMint,
      wallet.publicKey,
    );
    assert(nft.amount == BigInt(0), "User withdrew nft");
    const nftStakeAccount = await getAccount(
      provider.connection,
      stakeTokenAccount,
    );
    assert(nftStakeAccount.amount == BigInt(1), "NFT stake account lost nft");
    const userTokens = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      wallet.publicKey,
    );
    assert(userTokens.amount > BigInt(0), "User did not get any tokens");
    const stakeAccountAfter = await program.account.stakeInfo.fetch(stakeAccount);
    assert(stakeAccountAfter.stakedTime > stakeAccountBefore.stakedTime, "Staked time not updated");
  })
  it("can unstake nft, getting tokens", async () => {
    const { nftMint, stakeTokenAccount, stakeAccount } = await stake();
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      wallet.publicKey,
    );

    const nftAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      nftMint,
      wallet.publicKey,
    );
    await program.methods.unstake().accounts({
      stakeAccount,
      stakeTokenAccount,
      tokenMint: mint,
      user: wallet.publicKey,
      nftAccount: nftAccount.address,
      userTokenAccount: userTokenAccount.address,
      programAuthority,
    }).rpc();

    const stakedAccountAfter = await getAccount(
      provider.connection,
      stakeTokenAccount,
    );
    assert(stakedAccountAfter.amount == BigInt(0), "NFT not transferred to user");
    let nft = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      nftMint,
      wallet.publicKey,
    );
    assert(nft.amount == BigInt(1), "User does not have nft");

    let token = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      wallet.publicKey,
    )
    assert(token.amount > BigInt(0), "User did not get any tokens")
  });
});
