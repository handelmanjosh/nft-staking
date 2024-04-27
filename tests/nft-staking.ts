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
  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().accounts({
      mint,
    }).rpc();
    console.log("Your transaction signature", tx);
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
      programAuthority: program.programId,
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
  it("can unstake nft, getting tokens", async () => {
    const { nftMint, nftAccount, stakeTokenAccount, stakeAccount } = await stake();
    
  });
});
