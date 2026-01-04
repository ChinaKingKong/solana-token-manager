import { 
  PublicKey, 
  Transaction, 
  sendAndConfirmTransaction, 
  SystemProgram, 
  Keypair 
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
  burn,
  freezeAccount,
  thawAccount,
  getAccount,
  getMint,
  createSetAuthorityInstruction,
  AuthorityType
} from '@solana/spl-token';
import { connection } from './wallet';

// 创建新代币
export const createNewToken = async (
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number
) => {
  try {
    const tokenMint = await createMint(
      connection,
      payer,
      mintAuthority,
      freezeAuthority,
      decimals
    );
    
    return {
      success: true,
      tokenMint: tokenMint.toString()
    };
  } catch (error) {
    console.error('创建代币失败:', error);
    return {
      success: false,
      error
    };
  }
};

// 创建代币关联账户
export const createTokenAccount = async (
  payer: Keypair,
  owner: PublicKey,
  tokenMint: PublicKey
) => {
  try {
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      tokenMint,
      owner
    );
    
    return {
      success: true,
      tokenAccount: tokenAccount.address.toString()
    };
  } catch (error) {
    console.error('创建代币账户失败:', error);
    return {
      success: false,
      error
    };
  }
};

// 铸造代币
export const mintToken = async (
  payer: Keypair,
  tokenMint: PublicKey,
  destination: PublicKey,
  authority: Keypair,
  amount: number
) => {
  try {
    await mintTo(
      connection,
      payer,
      tokenMint,
      destination,
      authority,
      amount
    );
    
    return {
      success: true
    };
  } catch (error) {
    console.error('铸造代币失败:', error);
    return {
      success: false,
      error
    };
  }
};

// 转账代币
export const transferToken = async (
  payer: Keypair,
  source: PublicKey,
  destination: PublicKey,
  owner: Keypair,
  amount: number
) => {
  try {
    await transfer(
      connection,
      payer,
      source,
      destination,
      owner,
      amount
    );
    
    return {
      success: true
    };
  } catch (error) {
    console.error('转账代币失败:', error);
    return {
      success: false,
      error
    };
  }
};

// 销毁代币
export const burnToken = async (
  payer: Keypair,
  tokenAccount: PublicKey,
  mint: PublicKey,
  owner: Keypair,
  amount: number
) => {
  try {
    await burn(
      connection,
      payer,
      tokenAccount,
      mint,
      owner,
      amount
    );
    
    return {
      success: true
    };
  } catch (error) {
    console.error('销毁代币失败:', error);
    return {
      success: false,
      error
    };
  }
};

// 冻结账户
export const freezeTokenAccount = async (
  payer: Keypair,
  tokenAccount: PublicKey,
  mint: PublicKey,
  authority: Keypair
) => {
  try {
    await freezeAccount(
      connection,
      payer,
      tokenAccount,
      mint,
      authority
    );
    
    return {
      success: true
    };
  } catch (error) {
    console.error('冻结账户失败:', error);
    return {
      success: false,
      error
    };
  }
};

// 解冻账户
export const thawTokenAccount = async (
  payer: Keypair,
  tokenAccount: PublicKey,
  mint: PublicKey,
  authority: Keypair
) => {
  try {
    await thawAccount(
      connection,
      payer,
      tokenAccount,
      mint,
      authority
    );
    
    return {
      success: true
    };
  } catch (error) {
    console.error('解冻账户失败:', error);
    return {
      success: false,
      error
    };
  }
};

// 获取代币信息
export const getTokenInfo = async (tokenMint: PublicKey) => {
  try {
    const mintInfo = await getMint(connection, tokenMint);
    return {
      success: true,
      mintInfo
    };
  } catch (error) {
    console.error('获取代币信息失败:', error);
    return {
      success: false,
      error
    };
  }
}; 