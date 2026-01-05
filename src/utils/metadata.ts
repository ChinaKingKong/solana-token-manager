import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Connection,
} from '@solana/web3.js';

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

// 创建更新元数据账户的指令（手动构建，确保格式正确）
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
  const keys = [
    { pubkey: metadata, isSigner: false, isWritable: true },
    { pubkey: updateAuthority, isSigner: true, isWritable: false },
  ];

  const buffers: Buffer[] = [];
  
  // 指令 ID: 1 (UpdateMetadataAccountV2)
  buffers.push(Buffer.from([1]));

  // data: Option<Data>
  if (data.name || data.symbol || data.uri) {
    buffers.push(Buffer.from([1])); // Some
    
    // Data 结构
    buffers.push(serializeString(data.name || ''));
    buffers.push(serializeString(data.symbol || ''));
    buffers.push(serializeString(data.uri || ''));
    
    // sellerFeeBasisPoints: u16 (little-endian)
    const sellerFeeBuffer = Buffer.alloc(2);
    sellerFeeBuffer.writeUInt16LE(0, 0);
    buffers.push(sellerFeeBuffer);
    
    // creators: Option<Vec<Creator>> = None
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
  buffers.push(Buffer.from([1])); // Some
  buffers.push(Buffer.from([1])); // true

  return new TransactionInstruction({
    keys,
    programId: TOKEN_METADATA_PROGRAM_ID,
    data: Buffer.concat(buffers),
  });
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
        metadataUrl = `https://ipfs.io/ipfs/${uri.replace('ipfs://', '')}`;
      } else if (uri.startsWith('https://ipfs.io/ipfs/')) {
        metadataUrl = uri;
      } else if (uri.includes('mypinata.cloud')) {
        // Pinata 链接，直接使用
        metadataUrl = uri;
      }
      
      const response = await fetch(metadataUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const metadataJson = await response.json();
        logoURI = metadataJson.image || metadataJson.logoURI || metadataJson.logo;
      }
    } catch (error) {
      // 如果获取失败，忽略错误，继续使用链上的 name 和 symbol
      console.warn(`Failed to fetch metadata from URI ${uri}:`, error);
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
      console.warn(`[Metadata] RPC 获取失败，尝试直接获取: ${mint.toString()}`, rpcError);
    }

    // 回退到直接获取账户信息
    const accountInfo = await connection.getAccountInfo(metadataPDA);

    if (!accountInfo || !accountInfo.data) {
      console.log(`[Metadata] 账户不存在: ${mint.toString()}`);
      return null;
    }

    // 检查账户所有者是否是 Metaplex Token Metadata 程序
    if (!accountInfo.owner.equals(TOKEN_METADATA_PROGRAM_ID)) {
      console.log(`[Metadata] 账户所有者不匹配: ${mint.toString()}`);
      return null;
    }

    const data = accountInfo.data;
    return await parseMetadataAccount(data, mint);
  } catch (error) {
    // 如果获取失败，返回 null
    console.warn(`Failed to fetch on-chain metadata for mint ${mint.toString()}:`, error);
    return null;
  }
}

// 解析 metadata 账户数据
async function parseMetadataAccount(data: Buffer, mint: PublicKey): Promise<TokenMetadata | null> {
  try {
    
    // 如果数据太短，无法解析
    if (data.length < 100) {
      console.log(`[Metadata] 数据太短: ${mint.toString()}, length: ${data.length}`);
      return null;
    }

    let offset = 0;

    // 读取 key (1 byte) - 通常是 4 (MetadataV1) 或 6 (MetadataV2)
    const key = data[offset];
    console.log(`[Metadata] Key: ${key}, Data length: ${data.length}`);
    offset += 1;

    // 跳过 updateAuthority (32 bytes)
    if (offset + 32 > data.length) {
      console.log(`[Metadata] 数据不足，无法跳过 updateAuthority: ${mint.toString()}`);
      return null;
    }
    offset += 32;

    // 跳过 mint (32 bytes)
    if (offset + 32 > data.length) {
      console.log(`[Metadata] 数据不足，无法跳过 mint: ${mint.toString()}`);
      return null;
    }
    offset += 32;

    // 读取 data (Option<Data>)
    // Option 序列化：Some = [1], None = [0]
    if (offset >= data.length) {
      console.log(`[Metadata] 数据不足，无法读取 data option: ${mint.toString()}`);
      return null;
    }
    
    // 添加详细的调试信息
    const dataOptionByte = data[offset];
    console.log(`[Metadata] Offset: ${offset}, Data option byte: ${dataOptionByte}, Hex: 0x${dataOptionByte.toString(16)}`);
    
    // 打印前 100 个字节的十六进制，用于调试
    const previewBytes = Array.from(data.slice(0, Math.min(100, data.length)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    console.log(`[Metadata] 前100字节 (hex): ${previewBytes}`);
    
    const hasData = data[offset] === 1;
    offset += 1;

    if (!hasData) {
      console.log(`[Metadata] 没有 data 字段 (Option=None): ${mint.toString()}, offset: ${offset - 1}, byte: ${dataOptionByte}`);
      // 尝试检查是否是其他格式
      // 根据 Metaplex 源代码，某些版本可能直接包含 Data 结构，而不是 Option<Data>
      // 让我们尝试直接读取，看看是否有数据
      if (offset < data.length && data.length > 100) {
        console.log(`[Metadata] 尝试直接读取 Data 结构（跳过 Option）...`);
        // 不增加 offset，直接尝试读取
        try {
          const nameResult = deserializeString(data, offset - 1);
          const name = nameResult.value;
          const symbolResult = deserializeString(data, nameResult.newOffset);
          const symbol = symbolResult.value;
          const uriResult = deserializeString(data, symbolResult.newOffset);
          const uri = uriResult.value;
          
          if (name && symbol && uri) {
            console.log(`[Metadata] 成功解析（跳过 Option）: ${mint.toString()}`, { name, symbol, uri });
            // 继续处理 URI 获取 logo
            return await fetchMetadataFromURI(uri, { name, symbol });
          }
        } catch (error) {
          console.warn(`[Metadata] 直接读取失败: ${mint.toString()}`, error);
        }
      }
      return null;
    }

    if (offset >= data.length) {
      console.log(`[Metadata] 数据不足，无法读取 data 内容: ${mint.toString()}`);
      return null;
    }

    // 读取 Data 结构（DataV2）
    // name: string (u32 length + bytes)
    if (offset + 4 > data.length) {
      console.log(`[Metadata] 数据不足，无法读取 name: ${mint.toString()}`);
      return null;
    }
    const nameResult = deserializeString(data, offset);
    const name = nameResult.value;
    offset = nameResult.newOffset;

    // symbol: string (u32 length + bytes)
    if (offset + 4 > data.length) {
      console.log(`[Metadata] 数据不足，无法读取 symbol: ${mint.toString()}`);
      return null;
    }
    const symbolResult = deserializeString(data, offset);
    const symbol = symbolResult.value;
    offset = symbolResult.newOffset;

    // uri: string (u32 length + bytes)
    if (offset + 4 > data.length) {
      console.log(`[Metadata] 数据不足，无法读取 uri: ${mint.toString()}`);
      return null;
    }
    const uriResult = deserializeString(data, offset);
    const uri = uriResult.value;
    offset = uriResult.newOffset;

    console.log(`[Metadata] 成功解析: ${mint.toString()}`, { name, symbol, uri });

    // 如果 URI 存在，尝试从 URI 获取完整的元数据（包括 logo）
    return await fetchMetadataFromURI(uri, { name, symbol });
  } catch (error) {
    // 如果解析失败，返回 null
    console.warn(`Failed to parse metadata account for mint ${mint.toString()}:`, error);
    return null;
  }
}
