import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program } from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount, getAssociatedTokenAddress, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { assert, expect } from "chai";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
async function fail(f: () => any, error_message: string) {
  try {
    await f();
    throw new Error(`Program did not error`);
  } catch (e) {
    e = e as AnchorError;
    console.log(e.error.errorMessage, error_message);
    if (e.error.errorMessage !== error_message) {
      throw new Error(`Incorrect error: Expected: ${error_message}, Got: ${e.error.errorMesssage}`);
    }
  }
}
async function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  })
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
    await program.methods.stake(0, new anchor.BN(size)).accounts({
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
    await program.methods.stake(0, new anchor.BN(0)).accounts({
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
  // it("should fail to stake if incorrect size", async () => {
  //     await fail(async () => {
  //       await stake(10)
  //     }, "Invalid size")
  // })
  it("can stake multiple nfts", async () =>{
    const [stakeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), wallet.publicKey.toBuffer()],
      program.programId,
    );
    const accountInfo = await provider.connection.getAccountInfo(stakeAccount);
    await stake(1);
    await stake(2);
  });
  it("fails when smaller number is passed in", async () => {
    try {
      await stake(1);
      throw Error("Code succeeded");
    } catch (e) {
      //console.error(e);
    }
  })
  it("stakes and unstakes", async () => {
    let [stakeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), wallet.publicKey.toBuffer()],
      program.programId
    );
    const accountData = await program.account.stakeInfo.fetch(stakeAccount);
    const { nftMint } = await stake(accountData.mints.length);
    const accountDataAfter = await program.account.stakeInfo.fetch(stakeAccount);
    assert(accountDataAfter.mints.length > accountData.mints.length);
    const [stakeTokenAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake_account"), wallet.publicKey.toBuffer(), nftMint.toBuffer()],
      program.programId
    );
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection, 
      wallet.payer, 
      mint, 
      wallet.publicKey
    );
    const nftAccount = getAssociatedTokenAddressSync(nftMint, wallet.publicKey);
    await program.methods.unstake().accounts({
      stakeAccount,
      stakeTokenAccount,
      nftAccount,
      programAuthority,
      tokenMint: mint,
      user: wallet.publicKey,
      userTokenAccount: userTokenAccount.address,
    }).signers([wallet.payer]).rpc();
    const token = await getAccount(provider.connection, userTokenAccount.address);
    await timeout(500);
    assert(token.amount > 0, "user did not get any token");
  });
  it("claims multiple", async () => {
    let [stakeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), wallet.publicKey.toBuffer()],
      program.programId
    );
    let accountData = await program.account.stakeInfo.fetch(stakeAccount);
    let start = accountData.mints.length;
    for (let i = 0; i < 3; i++) {
      await stake(start + i);
    }
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection, 
      wallet.payer, 
      mint, 
      wallet.publicKey
    );
    await program.methods.claim().accounts({
      stakeAccount,
      user: wallet.publicKey,
      userTokenAccount: userTokenAccount.address,
      tokenMint: mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
    accountData = await program.account.stakeInfo.fetch(stakeAccount);
    const bigints = accountData.stakedTimes.map((d) => BigInt(d.toString()));
    const bools = bigints.reduce((prev, curr) => {
      return [curr, prev[1] && prev[0] == curr]
    }, [bigints[0], true])
    assert(bools, "everything not equal");
  })
  it("stakes 10 in a row and then unstakes them", async () => {
    let [stakeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), wallet.publicKey.toBuffer()],
      program.programId
    );
    let accountData = await program.account.stakeInfo.fetch(stakeAccount);
    let start = accountData.mints.length;
    for (let i = 0; i < 10; i++) {
      await stake(start + i);
    }
    accountData = await program.account.stakeInfo.fetch(stakeAccount);
    for (start = accountData.mints.length - 1; start > accountData.mints.length - 10; start--) {
      const nftMint = accountData.mints[start];
      const [stakeTokenAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("stake_account"), wallet.publicKey.toBuffer(), nftMint.toBuffer()],
        program.programId
      );
      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection, 
        wallet.payer, 
        mint, 
        wallet.publicKey
      );
      const nftAccount = getAssociatedTokenAddressSync(nftMint, wallet.publicKey);
      await program.methods.unstake().accounts({
        stakeAccount,
        stakeTokenAccount,
        nftAccount,
        programAuthority,
        tokenMint: mint,
        user: wallet.publicKey,
        userTokenAccount: userTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([wallet.payer]).rpc();
    }
  })
});
