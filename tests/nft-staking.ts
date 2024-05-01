import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } from "@solana/spl-token";
import { assert, expect } from "chai";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
async function fail(f: () => any, error_message: string) {
  try {
    await f();
    throw new Error(`Program did not error`);
  } catch (e) {
    e = e as AnchorError;
    if (e.error.errorMessage !== error_message) {
      throw new Error(`Incorrect error: Expected: ${error_message}, Got: ${e.error.errorMesssage}`);
    }
  }
}
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
  const mintNFT = async () => {
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
      [Buffer.from("stake"), wallet.publicKey.toBuffer()],
      program.programId,
    );
    const [stakeTokenAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake_account"), wallet.publicKey.toBuffer(), nftMint.toBuffer()],
      program.programId,
    )
    return { nftMint, nftAccount, stakeAccount, stakeTokenAccount };
  }
  const stake = async (size: number) => {
    const { nftMint, nftAccount, stakeAccount, stakeTokenAccount } = await mintNFT();
    await program.methods.stake(0, size).accounts({
      stakeAccount,
      stakeTokenAccount,
      user: wallet.publicKey,
      nftAccount: nftAccount.address,
      programAuthority,
      mint: nftMint
    }).signers([wallet.payer]).rpc();
    return { nftMint, nftAccount, stakeAccount, stakeTokenAccount };
  }
  it("can stake single nft", async () => {
    const { nftMint, nftAccount, stakeAccount, stakeTokenAccount } = await mintNFT();
    await program.methods.stake(0, 0).accounts({
      stakeAccount,
      stakeTokenAccount,
      user: wallet.publicKey,
      nftAccount: nftAccount.address,
      programAuthority,
      mint: nftMint
    }).signers([wallet.payer]).rpc();
    // const account = await program.account.stakeInfo.fetch(stakeAccount);
    // console.log(account);
  });
  it("should fail to stake if incorrect size", async () => {
      fail(async () => {
        await stake(10)
      }, "Invalid size")
  })
  it("can stake multiple nfts", async () =>{
    await stake(0);
    await stake(1);
  })
  it("can get data from multiple stakings", async () => {
    const { nftMint: nftMint1, nftAccount: nftAccount1, 
      stakeAccount: stakeAccount1, stakeTokenAccount: stakeTokenAccount1 } = await mintNFT();
    const { nftMint: nftMint2, nftAccount: nftAccount2, 
      stakeAccount: stakeAccount2, stakeTokenAccount: stakeTokenAccount2 } = await mintNFT();
    await program.methods.stake(0, 1).accounts({
      stakeAccount: stakeAccount1,
      stakeTokenAccount: stakeTokenAccount1,
      user: wallet.publicKey,
      mint: nftMint1,
      programAuthority,
      nftAccount: nftAccount1.address,
      tokenProgram: TOKEN_PROGRAM_ID
    }).rpc();
    await program.methods.stake(1, 1).accounts({
      stakeAccount: stakeAccount2,
      stakeTokenAccount: stakeTokenAccount2,
      user: wallet.publicKey,
      mint: nftMint2,
      programAuthority,
      nftAccount: nftAccount2.address,
      tokenProgram: TOKEN_PROGRAM_ID
    }).rpc();

    const fetched = await program.account.stakeInfo.all([
      {
        memcmp: {
          offset: 8,
          bytes: wallet.publicKey.toBase58(),
        }
      }
    ]);
    assert(fetched.length > 0);
    const fetched1 = await program.account.stakeInfo.all([
      {
        memcmp: {
          offset: 8,
          bytes: wallet.publicKey.toBase58()
        }
      },
      {
        memcmp: {
          offset: 40,
          bytes: bs58.encode(Buffer.from([1]))
        }
      }
    ]);
    assert(fetched1.length === 1);
  })
});
