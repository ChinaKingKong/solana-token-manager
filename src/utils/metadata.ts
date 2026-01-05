import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
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
