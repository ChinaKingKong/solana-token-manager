import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Connection,
} from '@solana/web3.js';
import { Buffer } from 'buffer';

// 确保 Buffer 在全局可用（双重保险）
if (typeof window !== 'undefined' && !(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

// Metaplex Token Metadata Program ID
// 注意：这个版本的库没有导出 TOKEN_METADATA_PROGRAM_ID，所以直接定义
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
);

// 获取 Metadata PDA 地址
export function getMetadataPDA(mint: PublicKey): PublicKey {
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return metadataPDA;
}

// 序列化字符串（Borsh 格式：u32 length + UTF-8 bytes）
function serializeString(str: string): Buffer {
  const strBuffer = Buffer.from(str, 'utf8');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32LE(strBuffer.length, 0);
  return Buffer.concat([lengthBuffer, strBuffer]);
}

// 创建更新元数据账户的指令 V2（手动构建，使用指令 ID 15）
// 根据 Metaplex Token Metadata 程序，UpdateMetadataAccountV2 使用指令 ID 15
export function createUpdateMetadataAccountV3Instruction(
  metadata: PublicKey,
  updateAuthority: PublicKey,
  data: {
    name?: string;
    symbol?: string;
    uri?: string;
    sellerFeeBasisPoints?: number;
    creators?: Array<{ address: PublicKey; verified: boolean; share: number }> | null;
  },
  newUpdateAuthority?: PublicKey,
  primarySaleHappened?: boolean,
  isMutable?: boolean
): TransactionInstruction {
  const keys = [
    { pubkey: metadata, isSigner: false, isWritable: true },
    { pubkey: updateAuthority, isSigner: true, isWritable: false },
  ];

  const buffers: Buffer[] = [];
  
  // 指令 ID: 15 (UpdateMetadataAccountV2)
  // 根据 Metaplex SDK 源代码，UpdateMetadataAccountV2 使用指令 ID 15
  buffers.push(Buffer.from([15]));

  // data: Option<DataV2>
  if (data.name || data.symbol || data.uri) {
    buffers.push(Buffer.from([1])); // Some
    
    // DataV2 结构
    buffers.push(serializeString(data.name || ''));
    buffers.push(serializeString(data.symbol || ''));
    buffers.push(serializeString(data.uri || ''));
    
    // sellerFeeBasisPoints: u16 (little-endian)
    const sellerFeeBuffer = Buffer.alloc(2);
    sellerFeeBuffer.writeUInt16LE(data.sellerFeeBasisPoints ?? 0, 0);
    buffers.push(sellerFeeBuffer);
    
    // creators: Option<Vec<Creator>>
    if (data.creators !== undefined) {
      if (data.creators === null || data.creators.length === 0) {
        buffers.push(Buffer.from([0])); // None
      } else {
        buffers.push(Buffer.from([1])); // Some
        // Vec length: u32
        const lengthBuffer = Buffer.alloc(4);
        lengthBuffer.writeUInt32LE(data.creators.length, 0);
        buffers.push(lengthBuffer);
        // Creator 结构
        for (const creator of data.creators) {
          buffers.push(creator.address.toBuffer());
          buffers.push(Buffer.from([creator.verified ? 1 : 0]));
          buffers.push(Buffer.from([creator.share]));
        }
      }
    } else {
      buffers.push(Buffer.from([0])); // None
    }
    
    // collection: Option<Collection> = None
    buffers.push(Buffer.from([0])); // None
    
    // uses: Option<Uses> = None
    buffers.push(Buffer.from([0])); // None
  } else {
    buffers.push(Buffer.from([0])); // None
  }

  // newUpdateAuthority: Option<Pubkey>
  if (newUpdateAuthority) {
    buffers.push(Buffer.from([1])); // Some
    buffers.push(newUpdateAuthority.toBuffer());
  } else {
    buffers.push(Buffer.from([0])); // None
  }

  // primarySaleHappened: Option<bool>
  if (primarySaleHappened !== undefined) {
    buffers.push(Buffer.from([1])); // Some
    buffers.push(Buffer.from([primarySaleHappened ? 1 : 0]));
  } else {
    buffers.push(Buffer.from([0])); // None
  }

  // isMutable: Option<bool>
  if (isMutable !== undefined) {
    buffers.push(Buffer.from([1])); // Some
    buffers.push(Buffer.from([isMutable ? 1 : 0]));
  } else {
    buffers.push(Buffer.from([0])); // None
  }

  return new TransactionInstruction({
    keys,
    programId: TOKEN_METADATA_PROGRAM_ID,
    data: Buffer.concat(buffers),
  });
}

// 保留 V2 函数以保持向后兼容，但内部调用 V3
export function createUpdateMetadataAccountV2Instruction(
  metadata: PublicKey,
  updateAuthority: PublicKey,
  data: {
    name?: string;
    symbol?: string;
    uri?: string;
  },
  newUpdateAuthority?: PublicKey,
  primarySaleHappened?: boolean
): TransactionInstruction {
  return createUpdateMetadataAccountV3Instruction(
    metadata,
    updateAuthority,
    data,
    newUpdateAuthority,
    primarySaleHappened,
    true // 默认保持可变
  );
}

// 创建元数据账户的指令（手动构建，确保格式正确）
// 根据 Metaplex Token Metadata 程序源代码：
// CreateMetadataAccountV3 指令 ID: 33
// 指令数据格式：
// - 指令 ID: 33 (u8)
// - CreateMetadataAccountArgsV3:
//   - data: DataV2
//   - isMutable: bool
//   - collectionDetails: Option<CollectionDetails>
//
// DataV2 结构：
// - name: string (u32 length + bytes)
// - symbol: string (u32 length + bytes)
// - uri: string (u32 length + bytes)
// - sellerFeeBasisPoints: u16
// - creators: Option<Vec<Creator>> (None = [0])
export function createCreateMetadataAccountV3Instruction(
  metadata: PublicKey,
  mint: PublicKey,
  mintAuthority: PublicKey,
  payer: PublicKey,
  updateAuthority: PublicKey,
  data: {
    name: string;
    symbol: string;
    uri: string;
  },
  isMutable: boolean = true
): TransactionInstruction {
  // 账户键顺序必须与 Metaplex 程序期望的顺序一致
  const keys = [
    { pubkey: metadata, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: mintAuthority, isSigner: true, isWritable: false },
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: updateAuthority, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const buffers: Buffer[] = [];
  
  // 指令 ID: 33 (CreateMetadataAccountV3)
  buffers.push(Buffer.from([33]));

  // DataV2 结构（必须包含所有字段）
  buffers.push(serializeString(data.name));
  buffers.push(serializeString(data.symbol));
  buffers.push(serializeString(data.uri));
  
  // sellerFeeBasisPoints: u16 (little-endian)
  const sellerFeeBuffer = Buffer.alloc(2);
  sellerFeeBuffer.writeUInt16LE(0, 0);
  buffers.push(sellerFeeBuffer);
  
  // creators: Option<Vec<Creator>> = None
  // Option 序列化：None = [0]
  buffers.push(Buffer.from([0])); // None

  // collection: Option<Collection> = None
  // Option 序列化：None = [0]
  buffers.push(Buffer.from([0])); // None

  // uses: Option<Uses> = None
  // Option 序列化：None = [0]
  buffers.push(Buffer.from([0])); // None

  // isMutable: bool
  buffers.push(Buffer.from([isMutable ? 1 : 0]));

  // collectionDetails: Option<CollectionDetails> = None
  // Option 序列化：None = [0]
  buffers.push(Buffer.from([0])); // None

  return new TransactionInstruction({
    keys,
    programId: TOKEN_METADATA_PROGRAM_ID,
    data: Buffer.concat(buffers),
  });
}

// 反序列化字符串（Borsh 格式：u32 length + UTF-8 bytes）
function deserializeString(buffer: Buffer, offset: number): { value: string; newOffset: number } {
  const length = buffer.readUInt32LE(offset);
  offset += 4;
  const value = buffer.slice(offset, offset + length).toString('utf8');
  return { value, newOffset: offset + length };
}

// 从 URI 获取完整的元数据（包括 logo）
async function fetchMetadataFromURI(
  uri: string,
  baseMetadata: { name: string; symbol: string }
): Promise<TokenMetadata> {
  let logoURI: string | undefined;
  
  if (uri) {
    try {
      // 转换 IPFS URI 为可访问的 URL
      let metadataUrl = uri;
      if (uri.startsWith('ipfs://')) {
        const cid = uri.replace('ipfs://', '').split('/')[0];
        // 尝试多个 IPFS 网关，提高成功率
        const gateways = [
          `https://ipfs.io/ipfs/${cid}`,
          `https://gateway.pinata.cloud/ipfs/${cid}`,
          `https://cloudflare-ipfs.com/ipfs/${cid}`,
          `https://dweb.link/ipfs/${cid}`,
        ];
        
        // 尝试第一个网关
        for (const gateway of gateways) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
            
            const response = await fetch(gateway, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            
            if (response.ok) {
              const metadataJson = await response.json();
              logoURI = metadataJson.image || metadataJson.logoURI || metadataJson.logo;
              break; // 成功获取，退出循环
            }
          } catch (error) {
            // 继续尝试下一个网关
            continue;
          }
        }
      } else if (uri.startsWith('https://ipfs.io/ipfs/')) {
        metadataUrl = uri;
      } else if (uri.includes('mypinata.cloud') || uri.includes('pinata.cloud')) {
        // Pinata 链接，直接使用
        metadataUrl = uri;
      } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
        // 其他 HTTP/HTTPS 链接
        metadataUrl = uri;
      }
      
      // 如果还没有获取到 logoURI，尝试从原始 URL 获取
      if (!logoURI && metadataUrl && (metadataUrl.startsWith('http://') || metadataUrl.startsWith('https://'))) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
          
          const response = await fetch(metadataUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const metadataJson = await response.json();
            logoURI = metadataJson.image || metadataJson.logoURI || metadataJson.logo;
          }
        } catch (error) {
          // 如果获取失败，忽略错误，继续使用链上的 name 和 symbol
        }
      }
    } catch (error) {
      // 如果获取失败，忽略错误，继续使用链上的 name 和 symbol
    }
  }

  return {
    name: baseMetadata.name || undefined,
    symbol: baseMetadata.symbol || undefined,
    uri: uri || undefined,
    logoURI,
  };
}

// 从链上获取代币元数据
export interface TokenMetadata {
  name?: string;
  symbol?: string;
  uri?: string;
  logoURI?: string;
}

export async function fetchOnChainMetadata(
  connection: Connection,
  mint: PublicKey
): Promise<TokenMetadata | null> {
  try {
    const metadataPDA = getMetadataPDA(mint);
    
    // 尝试使用 RPC 获取解析后的账户数据
    try {
      const response = await fetch(connection.rpcEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAccountInfo',
          params: [
            metadataPDA.toBase58(),
            {
              encoding: 'base64',
            }
          ]
        })
      });

      const data = await response.json();
      if (data.result && data.result.value) {
        const accountInfo = data.result.value;
        if (accountInfo.data && accountInfo.data[0]) {
          // 使用 base64 解码
          const accountData = Buffer.from(accountInfo.data[0], 'base64');
          return await parseMetadataAccount(accountData, mint);
        }
      }
    } catch (rpcError) {
      // RPC 获取失败，尝试直接获取
    }

    // 回退到直接获取账户信息
    const accountInfo = await connection.getAccountInfo(metadataPDA);

    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    // 检查账户所有者是否是 Metaplex Token Metadata 程序
    if (!accountInfo.owner.equals(TOKEN_METADATA_PROGRAM_ID)) {
      return null;
    }

    const data = accountInfo.data;
    return await parseMetadataAccount(data, mint);
  } catch (error) {
    // 如果获取失败，返回 null
    return null;
  }
}

// 从 metadata 账户数据中获取 update authority
export function getUpdateAuthorityFromMetadata(data: Buffer): PublicKey | null {
  try {
    if (data.length < 33) {
      return null;
    }
    
    // key (1 byte) + updateAuthority (32 bytes)
    const updateAuthorityBytes = data.slice(1, 33);
    return new PublicKey(updateAuthorityBytes);
  } catch (error) {
    return null;
  }
}

// 从 metadata 账户数据中解析 DataV2 字段（包括 sellerFeeBasisPoints 和 creators）
export function parseMetadataDataV2(data: Buffer): {
  sellerFeeBasisPoints: number;
  creators: Array<{ address: PublicKey; verified: boolean; share: number }> | null;
} | null {
  try {
    if (data.length < 100) {
      return null;
    }

    let offset = 0;
    
    // 跳过 key (1 byte)
    const key = data[offset];
    offset += 1;
    
    // 跳过 updateAuthority (32 bytes)
    offset += 32;
    
    // 跳过 mint (32 bytes)
    offset += 32;
    
    // 读取 data (Option<Data>)
    // 注意：MetadataV1 (Key 4) 和 MetadataV2 (Key 6) 的格式可能不同
    if (offset >= data.length) {
      return null;
    }
    
    const dataOption = data[offset];
    
    // MetadataV1 (Key 4) 可能直接包含 Data，而不是 Option<Data>
    // 如果 dataOption 不是 1，可能是直接的数据结构
    if (dataOption === 1) {
      // 标准格式：Option<Data> = Some
      offset += 1;
    } else if (key === 4) {
      // MetadataV1 可能直接是 Data 结构，不包含 Option 包装
      // 不增加 offset，直接读取 Data
    } else {
      // 尝试直接读取，可能是其他格式
      // 不增加 offset
    }
    
    // 跳过 name, symbol, uri (需要动态解析)
    // 使用 deserializeString 函数来正确解析
    try {
      const nameResult = deserializeString(data, offset);
      offset = nameResult.newOffset;
      
      const symbolResult = deserializeString(data, offset);
      offset = symbolResult.newOffset;
      
      const uriResult = deserializeString(data, offset);
      offset = uriResult.newOffset;
    } catch (error) {
      return null;
    }
    
    // sellerFeeBasisPoints: u16
    if (offset + 2 > data.length) {
      return null;
    }
    const sellerFeeBasisPoints = data.readUInt16LE(offset);
    offset += 2;
    
    // creators: Option<Vec<Creator>>
    if (offset >= data.length) {
      return null;
    }
    const hasCreators = data[offset] === 1;
    offset += 1;
    
    let creators: Array<{ address: PublicKey; verified: boolean; share: number }> | null = null;
    if (hasCreators) {
      if (offset + 4 > data.length) {
        return null;
      }
      const creatorsLength = data.readUInt32LE(offset);
      offset += 4;
      creators = [];
      for (let i = 0; i < creatorsLength; i++) {
        if (offset + 34 > data.length) {
          break;
        }
        const creatorAddress = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        const verified = data[offset] === 1;
        offset += 1;
        const share = data[offset];
        offset += 1;
        creators.push({ address: creatorAddress, verified, share });
      }
    }
    
    return { sellerFeeBasisPoints, creators };
  } catch (error) {
    return null;
  }
}

// 解析 metadata 账户数据
async function parseMetadataAccount(data: Buffer, mint: PublicKey): Promise<TokenMetadata | null> {
  try {
    // 如果数据太短，无法解析
    if (data.length < 100) {
      return null;
    }

    let offset = 0;

    // 读取 key (1 byte) - 通常是 4 (MetadataV1) 或 6 (MetadataV2)
    const key = data[offset];
    offset += 1;

    // 跳过 updateAuthority (32 bytes)
    if (offset + 32 > data.length) {
      return null;
    }
    offset += 32;

    // 跳过 mint (32 bytes)
    if (offset + 32 > data.length) {
      return null;
    }
    offset += 32;

    // 读取 data (Option<Data>)
    // Option 序列化：Some = [1], None = [0]
    if (offset >= data.length) {
      return null;
    }
    
    const dataOptionByte = data[offset];
    const hasData = data[offset] === 1;
    offset += 1;

    if (!hasData) {
      // 尝试检查是否是其他格式
      // 根据 Metaplex 源代码，某些版本可能直接包含 Data 结构，而不是 Option<Data>
      // 让我们尝试直接读取，看看是否有数据
      if (offset < data.length && data.length > 100) {
        // 不增加 offset，直接尝试读取
        try {
          const nameResult = deserializeString(data, offset - 1);
          const name = nameResult.value;
          const symbolResult = deserializeString(data, nameResult.newOffset);
          const symbol = symbolResult.value;
          const uriResult = deserializeString(data, symbolResult.newOffset);
          const uri = uriResult.value;
          
          if (name && symbol && uri) {
            // 继续处理 URI 获取 logo
            return await fetchMetadataFromURI(uri, { name, symbol });
          }
        } catch (error) {
          // 直接读取失败，返回 null
        }
      }
      return null;
    }

    if (offset >= data.length) {
      return null;
    }

    // 读取 Data 结构（DataV2）
    // name: string (u32 length + bytes)
    if (offset + 4 > data.length) {
      return null;
    }
    const nameResult = deserializeString(data, offset);
    const name = nameResult.value;
    offset = nameResult.newOffset;

    // symbol: string (u32 length + bytes)
    if (offset + 4 > data.length) {
      return null;
    }
    const symbolResult = deserializeString(data, offset);
    const symbol = symbolResult.value;
    offset = symbolResult.newOffset;

    // uri: string (u32 length + bytes)
    if (offset + 4 > data.length) {
      return null;
    }
    const uriResult = deserializeString(data, offset);
    const uri = uriResult.value;
    offset = uriResult.newOffset;

    // sellerFeeBasisPoints: u16 (little-endian)
    if (offset + 2 > data.length) {
      return null;
    }
    const sellerFeeBasisPoints = data.readUInt16LE(offset);
    offset += 2;

    // creators: Option<Vec<Creator>>
    const hasCreators = offset < data.length && data[offset] === 1;
    offset += 1;
    let creators: any[] | null = null;
    if (hasCreators) {
      // Vec length: u32
      if (offset + 4 > data.length) {
        return null;
      }
      const creatorsLength = data.readUInt32LE(offset);
      offset += 4;
      creators = [];
      for (let i = 0; i < creatorsLength; i++) {
        // Creator 结构: address (32 bytes) + verified (1 byte) + share (1 byte)
        if (offset + 34 > data.length) {
          break;
        }
        const creatorAddress = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        const verified = data[offset] === 1;
        offset += 1;
        const share = data[offset];
        offset += 1;
        creators.push({ address: creatorAddress, verified, share });
      }
    }

    // 如果 URI 存在，尝试从 URI 获取完整的元数据（包括 logo）
    return await fetchMetadataFromURI(uri, { name, symbol });
  } catch (error) {
    // 如果解析失败，返回 null
    return null;
  }
}
