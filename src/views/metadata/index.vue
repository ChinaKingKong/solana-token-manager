<script setup lang="ts">
import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useWallet } from '../../hooks/useWallet';
import MintAddressInput from '../../components/MintAddressInput.vue';
import { uploadJSONToIPFS, validatePinataCredentials } from '../../utils/ipfs';
import { getMetadataPDA, createUpdateMetadataAccountV3Instruction, createCreateMetadataAccountV3Instruction, TOKEN_METADATA_PROGRAM_ID, getUpdateAuthorityFromMetadata, parseMetadataDataV2 } from '../../utils/metadata';
import { getMint } from '@solana/spl-token';

const { t } = useI18n();
import {
  FileTextOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  UploadOutlined,
  GlobalOutlined,
  WalletOutlined,
} from '@ant-design/icons-vue';

// 使用钱包Hook
const walletContext = useWallet();
const walletState = walletContext.walletState;
const connection = computed(() => walletContext.connection.value);
const network = walletContext.network;

// Pinata API 配置
const pinataApiKey = ref('');
const pinataSecretApiKey = ref('');
const apiKeyValid = ref(false);
const validatingApiKey = ref(false);

// 元数据信息
const tokenMintAddress = ref('');
const tokenName = ref('');
const tokenSymbol = ref('');
const tokenDescription = ref('');
const tokenImage = ref('');
const metadataUrl = ref('');
const modifyAfterMint = ref(true);
const metadataJson = ref<any>(null);
const uploadingMetadata = ref(false);
const metadataSuccess = ref(false);

// 元数据来源模式
const metadataSourceMode = ref<'upload' | 'existing'>('upload');

// 状态
const processing = ref(false);

// 验证函数
const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};

// 验证Pinata API密钥
const validateApiKey = async () => {
  if (!pinataApiKey.value || !pinataSecretApiKey.value) {
    message.error(t('setMetadata.enterPinataApiKey'));
    apiKeyValid.value = false;
    return false;
      }
      
  validatingApiKey.value = true;
  
  try {
    const isValid = await validatePinataCredentials(
      pinataApiKey.value,
      pinataSecretApiKey.value
    );
    
    apiKeyValid.value = isValid;
    
    if (isValid) {
      message.success(t('ipfsUpload.validateSuccess'));
  } else {
      message.error(t('ipfsUpload.validateFailed'));
  }
    
    return isValid;
  } catch (error) {
    message.error(t('ipfsUpload.validateFailed'));
    apiKeyValid.value = false;
    return false;
  } finally {
    validatingApiKey.value = false;
  }
};

// 上传元数据到IPFS
const uploadMetadataToIPFS = async () => {
  if (!pinataApiKey.value || !pinataSecretApiKey.value) {
    message.error(t('ipfsUpload.apiKeyRequired'));
    return;
  }
  
  if (!tokenName.value || !tokenSymbol.value) {
    message.error(t('setMetadata.tokenNameRequired'));
    return;
  }
  
  // 验证API密钥
  if (!await validateApiKey()) {
    return;
  }
  
  uploadingMetadata.value = true;
  
  try {
    // 准备元数据JSON
    const metadata = {
      name: tokenName.value,
      symbol: tokenSymbol.value,
      description: tokenDescription.value || `${tokenName.value} token on Solana blockchain`,
      image: tokenImage.value || '',
      attributes: [],
      properties: {
        files: []
      }
    };
    
    metadataJson.value = metadata;
    
    // 上传到IPFS
    const result = await uploadJSONToIPFS(
      metadata,
      pinataApiKey.value,
      pinataSecretApiKey.value
    );
    
    if (result.success && result.url) {
      metadataUrl.value = result.url;
      message.success(t('ipfsUpload.uploadSuccess'));
    } else {
      message.error(t('ipfsUpload.uploadFailed'));
    }
  } catch (error) {
    message.error(t('ipfsUpload.uploadFailed'));
  } finally {
    uploadingMetadata.value = false;
  }
};

// 提交元数据设置
const submitMetadata = async () => {
  // 验证 Mint 地址
  if (!tokenMintAddress.value || tokenMintAddress.value.trim() === '') {
    message.error(t('setMetadata.mintAddressRequired'));
    return;
  }

  if (!isValidSolanaAddress(tokenMintAddress.value)) {
    message.error(t('setMetadata.mintAddressRequired'));
    return;
  }

  // 验证代币信息
  if (!tokenName.value || tokenName.value.trim() === '') {
    message.error(t('setMetadata.tokenNameRequired'));
    return;
  }
  
  if (!tokenSymbol.value || tokenSymbol.value.trim() === '') {
    message.error(t('setMetadata.tokenSymbolRequired'));
    return;
  }
  
  // 验证元数据 URL
  if (!metadataUrl.value || metadataUrl.value.trim() === '') {
    if (metadataSourceMode.value === 'upload') {
      message.error(t('setMetadata.metadataUrlRequired'));
    } else {
      message.error(t('setMetadata.metadataUrlRequired'));
    }
    return;
  }

  // 验证钱包连接
  if (!walletState.value?.connected || !walletState.value?.publicKey) {
    message.error(t('wallet.connectWallet'));
    return;
  }
  
  if (!walletState.value?.wallet) {
    message.error(t('wallet.connectWallet'));
    return;
  }
  
  processing.value = true;
  
  try {
    // 安全地创建 PublicKey
    let mintPubkey: PublicKey;
    try {
      mintPubkey = new PublicKey(tokenMintAddress.value.trim());
    } catch (error) {
      message.error(t('setMetadata.mintAddressRequired'));
      return;
    }

    const updateAuthority = walletState.value.publicKey!;
    const wallet = walletState.value.wallet;
    const conn = connection.value;

    // 验证钱包适配器
    if (!wallet || typeof wallet.sendTransaction !== 'function') {
      message.error(t('wallet.connectWallet'));
      return;
    }

    if (wallet.connected === false || !wallet.publicKey) {
      message.error(t('wallet.connectWallet'));
      return;
    }

    // 验证代币是否存在并获取 mint authority
    let mintInfo;
    let actualMintAuthority: PublicKey | null = null;
    try {
      mintInfo = await getMint(conn, mintPubkey);
      actualMintAuthority = mintInfo.mintAuthority;
    } catch (error) {
      message.error(t('setMetadata.accountNotFound'));
      return;
    }

    // 获取 Metadata PDA
    const metadataPDA = getMetadataPDA(mintPubkey);

    // 验证字符串长度
    const nameBytes = Buffer.from(tokenName.value.trim(), 'utf8').length;
    const symbolBytes = Buffer.from(tokenSymbol.value.trim(), 'utf8').length;
    const uriBytes = Buffer.from(metadataUrl.value.trim(), 'utf8').length;

    if (nameBytes > 32) {
      message.error(t('setMetadata.nameTooLong'));
      return;
    }
    if (symbolBytes > 10) {
      message.error(t('setMetadata.symbolTooLong'));
      return;
    }
    if (uriBytes > 200) {
      message.error(t('setMetadata.uriTooLong'));
      return;
    }

    // 检查 Metadata 账户是否存在
    let metadataExists = false;
    let actualUpdateAuthority: PublicKey | null = null;
    let existingDataV2: { sellerFeeBasisPoints: number; creators: Array<{ address: PublicKey; verified: boolean; share: number }> | null } | null = null;
    try {
      const accountInfo = await conn.getAccountInfo(metadataPDA);
      metadataExists = accountInfo !== null && accountInfo.owner.equals(TOKEN_METADATA_PROGRAM_ID);
      
      // 如果账户存在，解析 update authority 和现有数据
      if (metadataExists && accountInfo && accountInfo.data) {
        actualUpdateAuthority = getUpdateAuthorityFromMetadata(accountInfo.data);
        existingDataV2 = parseMetadataDataV2(accountInfo.data);
      }
  } catch (error) {
      metadataExists = false;
    }

    // 准备元数据数据（使用 trim 后的值，并保留现有字段）
    // 如果无法解析现有数据，使用默认值（0 和 null）
    const metadataData = {
      name: tokenName.value.trim(),
      symbol: tokenSymbol.value.trim(),
      uri: metadataUrl.value.trim(),
      sellerFeeBasisPoints: existingDataV2?.sellerFeeBasisPoints ?? 0,
      creators: existingDataV2?.creators ?? null,
    };

    // 创建交易
    const transaction = new Transaction();

    if (metadataExists) {
      // 如果元数据账户已存在，使用更新指令
      // 验证当前钱包是否是 update authority
      if (!actualUpdateAuthority) {
        message.error(t('setMetadata.permissionDenied') + ': ' + (t('setMetadata.accountNotFound') || '无法获取 update authority'));
        return;
      }
      
      if (!actualUpdateAuthority.equals(updateAuthority)) {
        message.error(t('setMetadata.permissionDenied') + ': ' + (t('setMetadata.notMintAuthority') || '当前钱包不是 update authority').replace('{authority}', actualUpdateAuthority.toString()));
        return;
      }
      
      const updateInstruction = createUpdateMetadataAccountV3Instruction(
        metadataPDA,
        updateAuthority,
        metadataData,
        undefined, // newUpdateAuthority
        undefined, // primarySaleHappened
        true // isMutable (保持可变)
      );
      transaction.add(updateInstruction);
    } else {
      // 如果元数据账户不存在，使用创建指令
      // 创建元数据需要 mint authority
      if (!actualMintAuthority) {
        message.error(t('setMetadata.permissionDenied'));
        return;
      }

      // 验证当前钱包是否是 mint authority
      if (!actualMintAuthority.equals(updateAuthority)) {
        message.error(t('setMetadata.permissionDenied'));
        return;
      }

      const createInstruction = createCreateMetadataAccountV3Instruction(
        metadataPDA,
        mintPubkey,
        actualMintAuthority, // 使用实际的 mint authority
        updateAuthority, // payer
        updateAuthority, // update authority
        metadataData,
        modifyAfterMint.value
      );

      transaction.add(createInstruction);
    }

    // 获取最近的区块哈希
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = updateAuthority;
    
    // 先模拟交易以获取详细错误信息
    try {
      const simulation = await conn.simulateTransaction(transaction);
      
      if (simulation.value.err) {
        const errorMsg = simulation.value.err.toString();
        message.error(`${t('setMetadata.setFailed')}: ${errorMsg}`);
        return;
      }
    } catch (simError: any) {
      // 继续尝试发送，因为某些情况下模拟可能失败但实际发送会成功
    }
    
    // 发送交易
    let signature: string;
    try {
      signature = await wallet.sendTransaction(transaction, conn);
    } catch (sendError: any) {
      // 如果直接发送失败，尝试先签名再发送
      if (typeof wallet.signTransaction === 'function') {
        try {
          const signedTransaction = await wallet.signTransaction(transaction);
          signature = await conn.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });
        } catch (signError: any) {
          throw sendError; // 抛出原始错误
        }
      } else {
        throw sendError;
      }
    }

    // 等待确认
    const confirmation = await conn.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`${t('setMetadata.setFailed')}: ${JSON.stringify(confirmation.value.err)}`);
    }

    metadataSuccess.value = true;
    message.success(t('setMetadata.setSuccess'));
  } catch (error: any) {
    // 处理特定错误
    if (error.message?.includes('User rejected') || error.message?.includes('用户取消') || error.message?.includes('rejected')) {
      message.warning(t('setMetadata.userCancelled') || t('createToken.userCancelled'));
    } else if (error.message?.includes('Insufficient funds') || error.message?.includes('insufficient funds')) {
      message.error(t('setMetadata.insufficientFunds'));
    } else if (error.message?.includes('InvalidAccountData') || error.message?.includes('AccountNotFound')) {
      message.error(t('setMetadata.accountNotFound'));
    } else if (error.message?.includes('0x1') || error.message?.includes('ConstraintRaw') || error.message?.includes('constraint')) {
      message.error(t('setMetadata.permissionDenied'));
    } else if (error.message?.includes('0x0') || error.message?.includes('Insufficient')) {
      message.error(t('setMetadata.insufficientFunds'));
    } else if (error.message?.includes('Simulation failed') || error.message?.includes('simulation failed')) {
      message.error(error.message);
    } else if (error.name === 'WalletSendTransactionError' || error.message?.includes('Unexpected error')) {
      // 处理 WalletSendTransactionError，提供更详细的错误提示
      const detailedError = error.message || error.toString() || '交易发送失败';
      message.error(`${t('setMetadata.setFailed')}: ${detailedError}`);
    } else if (error.logs && Array.isArray(error.logs)) {
      // 尝试从日志中提取错误信息
      const errorLog = error.logs.find((log: string) => log.includes('Error') || log.includes('error'));
      if (errorLog) {
        message.error(`${t('setMetadata.setFailed')}: ${errorLog}`);
      } else {
        const errorMsg = error.message || error.toString() || t('common.error');
        message.error(`${t('setMetadata.setFailed')}: ${errorMsg}`);
      }
    } else {
      // 尝试获取更详细的错误信息
      let errorMsg = '';
      if (error.message) {
        errorMsg = error.message;
      } else if (error.toString && error.toString() !== '[object Object]') {
        errorMsg = error.toString();
      } else if (error.name) {
        errorMsg = error.name;
      } else {
        errorMsg = t('common.error') || '未知错误';
      }
      
      message.error(`${t('setMetadata.setFailed')}: ${errorMsg}`);
    }
  } finally {
    processing.value = false;
  }
};

// 复制链接到剪贴板
const copyUrl = (url: string) => {
  navigator.clipboard.writeText(url)
    .then(() => {
      message.success(t('wallet.addressCopied'));
    })
    .catch(() => {
      message.error(t('common.error'));
    });
};

// 转换为IPFS.io链接
const convertToIpfsIo = () => {
  if (metadataUrl.value.includes('mypinata.cloud/ipfs/')) {
    const parts = metadataUrl.value.split('/ipfs/');
    if (parts.length === 2) {
      const cid = parts[1].trim();
      if (cid) {
        metadataUrl.value = `https://ipfs.io/ipfs/${cid}`;
        message.success(t('setMetadata.convertToIpfsSuccess'));
        return;
      }
    }
    message.error(t('setMetadata.convertToIpfsFailed'));
  } else {
    message.info(t('setMetadata.convertToIpfsNotNeeded'));
  }
};

// 在Solscan查看
const viewOnSolscan = (mint: string) => {
  const cluster = network.value === 'mainnet' ? '' : `?cluster=${network.value}`;
  window.open(`https://solscan.io/token/${mint}${cluster}`, '_blank');
};

  // 重置表单
const resetForm = () => {
  metadataSuccess.value = false;
  tokenMintAddress.value = '';
  tokenName.value = '';
  tokenSymbol.value = '';
  tokenDescription.value = '';
  tokenImage.value = '';
  metadataUrl.value = '';
  modifyAfterMint.value = true;
  metadataJson.value = null;
};

// 格式化地址
const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
};

// 默认导出
defineOptions({
  name: 'SetMetadata',
});
</script>

<template>
  <div class="p-0 w-full max-w-full animate-[fadeIn_0.3s_ease-in] min-h-full flex flex-col">
    <!-- 未连接钱包提示 -->
    <div v-if="!walletState || !walletState.connected" class="flex items-center justify-center min-h-[400px] flex-1">
      <div class="text-center">
        <div class="mb-6 animate-bounce">
          <WalletOutlined class="text-6xl text-white/30" />
        </div>
        <h3 class="text-2xl font-bold text-white mb-2">{{ t('wallet.connectWallet') }}</h3>
        <p class="text-white/60">{{ t('setMetadata.title') }}</p>
      </div>
    </div>

    <!-- 成功状态 -->
    <div v-else-if="metadataSuccess" class="flex-1 flex flex-col min-h-0 py-3">
      <div
        class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border-2 border-[rgba(82,196,26,0.3)] rounded-2xl p-6 overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(82,196,26,0.5)] hover:shadow-[0_20px_40px_rgba(82,196,26,0.2)]">
        <div
          class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
        </div>
        <div class="relative z-[1]">
          <div class="flex items-center gap-3 mb-6">
            <CheckCircleOutlined class="text-3xl text-[#52c41a]" />
            <div>
              <h3 class="m-0 text-xl font-semibold text-white">{{ t('setMetadata.setSuccess') }}</h3>
              <p class="m-0 text-sm text-white/60 mt-1">{{ t('setMetadata.setSuccess') }}</p>
            </div>
          </div>

          <div class="space-y-4">
            <!-- Mint 地址 -->
            <div v-if="tokenMintAddress" class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center justify-between mb-3">
                <h3 class="m-0 text-base font-semibold text-white">{{ t('setMetadata.successMintAddress') }}</h3>
                <a-button
                  @click="viewOnSolscan(tokenMintAddress)"
                  type="text"
                  class="flex items-center justify-center text-white px-0 py-0 h-auto transition-all duration-300 ease-in-out hover:text-solana-green">
                  <template #icon>
                    <GlobalOutlined />
                  </template>
                  {{ t('setMetadata.viewOnSolscan') }}
                </a-button>
              </div>
              <div class="flex items-center gap-2 bg-white/5 rounded-xl p-3 border border-white/10">
                <code class="text-sm text-white/90 font-mono break-all flex-1 min-w-0">{{ tokenMintAddress }}</code>
                <a-button
                  @click="copyUrl(tokenMintAddress)"
                  type="text"
                  size="small"
                  class="flex items-center justify-center text-white px-2 py-1 h-auto transition-all duration-300 ease-in-out hover:text-solana-green flex-shrink-0">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                  {{ t('common.copy') }}
                </a-button>
              </div>
            </div>

            <!-- 元数据URL -->
            <div v-if="metadataUrl" class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-2 mb-3">
                <span class="text-base font-semibold text-white">{{ t('setMetadata.successMetadataUrl') }}</span>
              </div>
              <div class="flex items-center gap-2 bg-white/5 rounded-xl p-3 border border-white/10">
                <code class="text-sm text-white/90 font-mono break-all flex-1 min-w-0">{{ metadataUrl }}</code>
                <a-button
                  @click="copyUrl(metadataUrl)"
                  type="text"
                  size="small"
                  class="flex items-center justify-center text-white px-2 py-1 h-auto transition-all duration-300 ease-in-out hover:text-solana-green flex-shrink-0">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                  {{ t('common.copy') }}
                </a-button>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex gap-3 pt-4">
              <a-button @click="resetForm"
                class="flex-1 flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-2.5 h-auto text-[15px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300">
                <template #icon>
                  <FileTextOutlined />
                </template>
                {{ t('setMetadata.continue') }}
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 设置元数据表单 -->
    <div v-else class="w-full py-3">
      <div
        class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border border-white/10 rounded-2xl p-6 overflow-visible transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(20,241,149,0.3)] hover:shadow-[0_8px_32px_rgba(20,241,149,0.15)]">
        <div
          class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
        </div>
        <div class="relative z-[1] space-y-6">
          <!-- 标题和说明 -->
          <div>
            <h2 class="m-0 text-2xl font-semibold text-white mb-2">{{ t('setMetadata.title') }}</h2>
            <div class="flex items-start gap-3 p-4 bg-[rgba(20,241,149,0.1)] rounded-xl border border-[rgba(20,241,149,0.2)]">
              <InfoCircleOutlined class="text-solana-green text-lg shrink-0 mt-0.5" />
              <div class="flex-1">
                <div class="text-sm font-medium text-solana-green mb-1">{{ t('setMetadata.metadataDescription') }}</div>
                <div class="text-xs text-white/70">
                  <ul class="m-0 pl-4 space-y-1">
                    <li>{{ t('setMetadata.metadataDescription1') }}</li>
                    <li>{{ t('setMetadata.metadataDescription2') }}</li>
                    <li>{{ t('setMetadata.metadataDescription3') }}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- 代币Mint地址 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('setMetadata.mintAddress') }} <span class="text-red-400">*</span>
            </label>
            <MintAddressInput
              v-model="tokenMintAddress"
              :desc="t('setMetadata.mintAddress')"
            >
              <template #error>
                {{ t('setMetadata.addressInvalid') }}
              </template>
            </MintAddressInput>
          </div>

          <!-- 代币信息 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-white/90 mb-2">
                {{ t('setMetadata.tokenName') }} <span class="text-red-400">*</span>
              </label>
              <a-input
                v-model:value="tokenName"
                :placeholder="t('setMetadata.tokenNamePlaceholder')"
                size="large"
                class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                :class="{ '!border-solana-green': tokenName }"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-white/90 mb-2">
                {{ t('setMetadata.tokenSymbol') }} <span class="text-red-400">*</span>
              </label>
              <a-input
                v-model:value="tokenSymbol"
                :placeholder="t('setMetadata.tokenSymbolPlaceholder')"
                size="large"
                class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl uppercase"
                :class="{ '!border-solana-green': tokenSymbol }"
                :maxlength="10"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('setMetadata.tokenDescription') }}
            </label>
            <a-textarea
              v-model:value="tokenDescription"
              :placeholder="t('setMetadata.tokenDescriptionPlaceholder')"
              :rows="3"
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl"
              :class="{ '!border-solana-green': tokenDescription }"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('setMetadata.tokenImage') }}
            </label>
            <a-input
              v-model:value="tokenImage"
              :placeholder="t('setMetadata.tokenImagePlaceholder')"
              size="large"
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl"
              :class="{ '!border-solana-green': tokenImage }"
            />
            <div class="mt-1.5 text-xs text-white/50">{{ t('setMetadata.tokenImage') }}</div>
          </div>

          <!-- 元数据来源选择 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">{{ t('setMetadata.metadataSource') }}</label>
            <a-radio-group v-model:value="metadataSourceMode" button-style="solid" class="w-full">
              <a-radio-button value="upload" class="flex-1">
                <template #icon>
                  <UploadOutlined />
                </template>
                {{ t('setMetadata.uploadNew') }}
              </a-radio-button>
              <a-radio-button value="existing" class="flex-1">
                <template #icon>
                  <GlobalOutlined />
                </template>
                {{ t('setMetadata.useExisting') }}
              </a-radio-button>
            </a-radio-group>
          </div>

          <!-- Pinata API配置（仅在上传模式显示） -->
          <div v-if="metadataSourceMode === 'upload'" class="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 class="m-0 text-lg font-semibold text-white mb-4">{{ t('setMetadata.pinataIpfsConfig') }}</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-white/90 mb-2">
                  Pinata API Key <span class="text-red-400">*</span>
                </label>
                <a-input
                  v-model:value="pinataApiKey"
                  :placeholder="t('setMetadata.enterPinataApiKey')"
                  size="large"
                  class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                  :class="{ '!border-solana-green': pinataApiKey }"
                />
              </div>
        
              <div>
                <label class="block text-sm font-medium text-white/90 mb-2">
                  Pinata Secret API Key <span class="text-red-400">*</span>
                </label>
          <a-input 
            v-model:value="pinataSecretApiKey" 
                  :placeholder="t('ipfsUpload.enterPinataSecretKey')"
            type="password"
                  size="large"
                  class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                  :class="{ '!border-solana-green': pinataSecretApiKey }"
          />
              </div>
              
              <div class="flex items-center gap-3">
                <a-button
                  type="primary"
                  :loading="validatingApiKey"
                  @click="validateApiKey"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <ReloadOutlined />
                  </template>
                  {{ t('setMetadata.validateApiKey') }}
                </a-button>
                <div v-if="apiKeyValid" class="flex items-center gap-2 text-green-400">
                  <CheckCircleOutlined />
                  <span class="text-sm">{{ t('ipfsUpload.apiKeyValidated') }}</span>
                </div>
              </div>
              
              <div class="text-xs text-white/50">
                {{ t('ipfsUpload.securityNote') }}
              </div>
            </div>
          </div>

          <!-- 上传元数据按钮（仅在上传模式显示） -->
          <div v-if="metadataSourceMode === 'upload'">
        <a-button 
          type="primary" 
          :loading="uploadingMetadata" 
          @click="uploadMetadataToIPFS"
              :disabled="!apiKeyValid || !tokenName || !tokenSymbol"
              size="large"
              block
              class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-6 py-3 h-auto text-[16px] hover:bg-white/15 hover:border-white/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
              <template #icon>
                <UploadOutlined />
              </template>
              {{ uploadingMetadata ? t('setMetadata.uploadingMetadata') : t('setMetadata.uploadMetadataToIpfs') }}
        </a-button>
      </div>
      
          <!-- 元数据URL -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('setMetadata.metadataUrlLabel') }} <span class="text-red-400">*</span>
            </label>
            <div class="flex items-center gap-2">
        <a-input 
          v-model:value="metadataUrl" 
                :placeholder="t('setMetadata.metadataUrlPlaceholderExample')"
                size="large"
                class="flex-1 bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl font-mono"
                :class="{ '!border-solana-green': metadataUrl }"
              />
              <a-button
                v-if="metadataUrl.includes('mypinata.cloud')"
                @click="convertToIpfsIo"
                class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                <template #icon>
                  <GlobalOutlined />
                </template>
                {{ t('ipfsUpload.convert') }}
          </a-button>
        </div>
            <div class="mt-1.5 text-xs text-white/50">
              {{ metadataSourceMode === 'upload' ? t('setMetadata.metadataUrlDescUpload') : t('setMetadata.metadataUrlDescExisting') }}
            </div>
          </div>
      
          <!-- 元数据预览 -->
          <div v-if="metadataJson" class="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 class="m-0 text-base font-semibold text-white mb-4">{{ t('setMetadata.metadataPreview') }}</h3>
            <pre class="text-xs text-white/80 font-mono bg-white/5 rounded-lg p-4 border border-white/10 overflow-auto max-h-64">{{ JSON.stringify(metadataJson, null, 2) }}</pre>
          </div>
      
          <!-- 权限设置 -->
          <div class="bg-white/5 rounded-xl p-4 border border-white/10">
            <a-checkbox v-model:checked="modifyAfterMint" class="text-white/90">
              {{ t('setMetadata.allowModifyAfterMint') }}
        </a-checkbox>
            <div class="mt-2 text-xs text-white/50">
              {{ t('setMetadata.allowModifyAfterMintDesc') }}
            </div>
          </div>

          <!-- 提示信息 -->
          <div
            class="flex items-start gap-3 p-4 bg-[rgba(20,241,149,0.1)] rounded-xl border border-[rgba(20,241,149,0.2)]">
            <InfoCircleOutlined class="text-solana-green text-lg shrink-0 mt-0.5" />
            <div class="flex-1">
              <div class="text-sm font-medium text-solana-green mb-1">{{ t('setMetadata.setTip') }}</div>
              <div class="text-xs text-white/70">
                <ul class="m-0 pl-4 space-y-1">
                  <li v-if="metadataSourceMode === 'upload'">{{ t('setMetadata.setTip1') }}</li>
                  <li v-else>{{ t('setMetadata.setTip2') }}</li>
                  <li>{{ t('setMetadata.setTip3') }}</li>
                  <li>{{ t('setMetadata.setTip4') }}</li>
                  <li v-if="metadataSourceMode === 'existing'">{{ t('setMetadata.setTip5') }}</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- 设置按钮 -->
          <div class="pt-2">
        <a-button 
          type="primary" 
          :loading="processing" 
              :disabled="!isValidSolanaAddress(tokenMintAddress) || !tokenName || !tokenSymbol || !metadataUrl"
          @click="submitMetadata"
              size="large"
              block
              class="flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-3 h-auto text-[16px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
              <template #icon>
                <FileTextOutlined />
              </template>
              {{ processing ? t('setMetadata.setting') : t('setMetadata.set') }}
        </a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
}
}

/* 输入框样式覆盖 */
:deep(.ant-input),
:deep(.ant-input-password),
:deep(.ant-input-password input),
:deep(.ant-input) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-input:focus),
:deep(.ant-input-focused),
:deep(.ant-input-password:focus),
:deep(.ant-input-password-focused) {
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-color: #14f195 !important;
  box-shadow: 0 0 0 2px rgba(20, 241, 149, 0.2) !important;
}

:deep(.ant-input::placeholder),
:deep(.ant-input-password input::placeholder) {
  color: rgba(255, 255, 255, 0.4) !important;
}

/* 文本域样式覆盖 */
:deep(.ant-input) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-input:focus),
:deep(.ant-input-focused) {
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-color: #14f195 !important;
  box-shadow: 0 0 0 2px rgba(20, 241, 149, 0.2) !important;
}

/* 复选框样式 */
:deep(.ant-checkbox-wrapper) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-checkbox-inner) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

:deep(.ant-checkbox-checked .ant-checkbox-inner) {
  background-color: #14f195 !important;
  border-color: #14f195 !important;
}

/* 单选按钮组样式 */
:deep(.ant-radio-group) {
  display: flex;
  gap: 8px;
}

:deep(.ant-radio-button-wrapper) {
  flex: 1;
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.ant-radio-button-wrapper:hover) {
  border-color: rgba(255, 255, 255, 0.3) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-radio-button-wrapper-checked) {
  background-color: rgba(20, 241, 149, 0.2) !important;
  border-color: #14f195 !important;
  color: #14f195 !important;
}

/* 按钮样式覆盖 */
:deep(.ant-btn-primary:disabled) {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.4) !important;
}
</style> 
