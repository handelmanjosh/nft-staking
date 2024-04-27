import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";
describe("nft-staking", () => {
  console.log("HELLO");
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.NftStaking as Program<NftStaking>;

  const [ mint ] = anchor.web3.PublicKey.findProgramAddressSync(
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
  it("can stake nft", async () => {
      // create nft collection for testing
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
    const [ stakeAccount ] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), wallet.publicKey.toBuffer(), nftAccount.address.toBuffer()],
      program.programId,
    );
    await program.methods.stake().accounts({
        stakeAccount,
        user: wallet.publicKey,
        nftAccount: nftAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([wallet.payer]).rpc();
      const fetched = await program.account.stakeInfo.fetch(stakeAccount);

      assert(fetched.mint.toString() == nftMint.toString());
      assert(fetched.owner.toString() == wallet.publicKey.toString());
      assert(fetched.stakedTime.toNumber() > 0);
      const stakedTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        nftMint,
        stakeAccount
      );
      assert(stakedTokenAccount.amount == BigInt(1));
      let nft = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        nftMint,
        wallet.publicKey,
      );
      assert(nft.amount == BigInt(0));
  });
  it("can unstake nft, getting tokens", async () => {

  });
});
