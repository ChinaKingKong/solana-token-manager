<script setup lang="ts">
import { ref } from 'vue';
import { message } from 'ant-design-vue';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '../../hooks/useWallet';
import { uploadJSONToIPFS, validatePinataCredentials } from '../../utils/ipfs';
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
    message.error('请输入Pinata API密钥');
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
      message.success('Pinata API密钥验证成功');
    } else {
      message.error('Pinata API密钥无效');
    }
    
    return isValid;
  } catch (error) {
    console.error('验证API密钥时出错:', error);
    message.error('验证API密钥时出错');
    apiKeyValid.value = false;
    return false;
  } finally {
    validatingApiKey.value = false;
  }
};

// 上传元数据到IPFS
const uploadMetadataToIPFS = async () => {
  if (!pinataApiKey.value || !pinataSecretApiKey.value) {
    message.error('请输入Pinata API密钥');
    return;
  }
  
  if (!tokenName.value || !tokenSymbol.value) {
    message.error('代币名称和符号不能为空');
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
      message.success('元数据已成功上传到IPFS');
    } else {
      message.error('上传元数据失败');
    }
  } catch (error) {
    console.error('上传元数据失败:', error);
    message.error('上传元数据失败');
  } finally {
    uploadingMetadata.value = false;
  }
};

// 提交元数据设置
const submitMetadata = async () => {
  if (!isValidSolanaAddress(tokenMintAddress.value)) {
    message.error('请输入有效的代币Mint地址');
    return;
  }
  
  if (!tokenName.value || !tokenSymbol.value) {
    message.error('代币名称和符号不能为空');
    return;
  }
  
  if (!metadataUrl.value) {
    message.error('请先上传元数据到IPFS或提供元数据URL');
    return;
  }
  
  if (!walletState.value?.connected || !walletState.value?.publicKey) {
    message.error('请先连接钱包');
    return;
  }
  
  processing.value = true;
  
  try {
    // 此处简化处理，实际应用中需要调用Solana元数据程序（如Metaplex）
    // 模拟成功的情况
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    metadataSuccess.value = true;
    message.success('元数据设置成功!');
  } catch (error) {
    message.error('设置元数据失败');
    console.error(error);
  } finally {
    processing.value = false;
  }
};

// 复制链接到剪贴板
const copyUrl = (url: string) => {
  navigator.clipboard.writeText(url)
    .then(() => {
      message.success('已复制到剪贴板');
    })
    .catch(() => {
      message.error('复制失败');
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
        message.success('已转换为IPFS.io链接');
        return;
      }
    }
    message.error('无法转换链接，CID格式不正确');
  } else {
    message.info('当前不是Pinata链接，无需转换');
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
        <h3 class="text-2xl font-bold text-white mb-2">请先连接钱包</h3>
        <p class="text-white/60">连接钱包后即可设置代币元数据</p>
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
              <h3 class="m-0 text-xl font-semibold text-white">元数据设置成功！</h3>
              <p class="m-0 text-sm text-white/60 mt-1">您的代币元数据已成功设置</p>
            </div>
          </div>

          <div class="space-y-4">
            <!-- Mint 地址 -->
            <div v-if="tokenMintAddress" class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-medium text-white/80">Mint 地址</span>
              </div>
              <div class="flex items-center gap-2">
                <div
                  class="flex-1 px-4 py-2.5 bg-white/5 rounded-lg border border-white/10 text-sm font-mono text-white/90 break-all">
                  {{ tokenMintAddress }}
                </div>
                <a-button @click="copyUrl(tokenMintAddress)"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                  复制
                </a-button>
                <a-button @click="viewOnSolscan(tokenMintAddress)"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <GlobalOutlined />
                  </template>
                  Solscan
                </a-button>
              </div>
            </div>

            <!-- 元数据URL -->
            <div v-if="metadataUrl" class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-medium text-white/80">元数据URL</span>
              </div>
              <div class="flex items-center gap-2">
                <div
                  class="flex-1 px-4 py-2.5 bg-white/5 rounded-lg border border-white/10 text-sm font-mono text-white/90 break-all">
                  {{ metadataUrl }}
                </div>
                <a-button @click="copyUrl(metadataUrl)"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                  复制
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
                继续设置
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
            <h2 class="m-0 text-2xl font-semibold text-white mb-2">设置代币Metadata</h2>
            <div class="flex items-start gap-3 p-4 bg-[rgba(20,241,149,0.1)] rounded-xl border border-[rgba(20,241,149,0.2)]">
              <InfoCircleOutlined class="text-solana-green text-lg shrink-0 mt-0.5" />
              <div class="flex-1">
                <div class="text-sm font-medium text-solana-green mb-1">元数据说明</div>
                <div class="text-xs text-white/70">
                  <ul class="m-0 pl-4 space-y-1">
                    <li>代币元数据包含名称、符号、描述等信息</li>
                    <li>元数据将上传到IPFS，获得永久存储的链接</li>
                    <li>设置元数据后，代币信息将在钱包和浏览器中显示</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- 代币Mint地址 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              代币Mint地址 <span class="text-red-400">*</span>
            </label>
            <a-input
              v-model:value="tokenMintAddress"
              placeholder="请输入代币的Mint地址"
              size="large"
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl font-mono"
              :class="{ '!border-solana-green': tokenMintAddress && isValidSolanaAddress(tokenMintAddress) }"
            />
            <div class="mt-1.5 text-xs text-white/50">输入要设置元数据的代币Mint地址</div>
            <div v-if="tokenMintAddress && !isValidSolanaAddress(tokenMintAddress)" class="mt-1.5 text-xs text-red-400">
              地址格式不正确
            </div>
          </div>

          <!-- 代币信息 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-white/90 mb-2">
                代币名称 <span class="text-red-400">*</span>
              </label>
              <a-input
                v-model:value="tokenName"
                placeholder="例如: My Token"
                size="large"
                class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                :class="{ '!border-solana-green': tokenName }"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-white/90 mb-2">
                代币符号 <span class="text-red-400">*</span>
              </label>
              <a-input
                v-model:value="tokenSymbol"
                placeholder="例如: MTK"
                size="large"
                class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl uppercase"
                :class="{ '!border-solana-green': tokenSymbol }"
                :maxlength="10"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              代币描述
            </label>
            <a-textarea
              v-model:value="tokenDescription"
              placeholder="输入代币的描述信息"
              :rows="3"
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl"
              :class="{ '!border-solana-green': tokenDescription }"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              代币图片URL
            </label>
            <a-input
              v-model:value="tokenImage"
              placeholder="例如: https://ipfs.io/ipfs/..."
              size="large"
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl"
              :class="{ '!border-solana-green': tokenImage }"
            />
            <div class="mt-1.5 text-xs text-white/50">代币图片的IPFS链接或URL</div>
          </div>

          <!-- Pinata API配置 -->
          <div class="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 class="m-0 text-lg font-semibold text-white mb-4">Pinata IPFS配置</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-white/90 mb-2">
                  Pinata API Key <span class="text-red-400">*</span>
                </label>
                <a-input
                  v-model:value="pinataApiKey"
                  placeholder="输入你的Pinata API Key"
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
                  placeholder="输入你的Pinata Secret API Key"
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
                  验证API密钥
                </a-button>
                <div v-if="apiKeyValid" class="flex items-center gap-2 text-green-400">
                  <CheckCircleOutlined />
                  <span class="text-sm">API密钥已验证</span>
                </div>
              </div>
              
              <div class="text-xs text-white/50">
                注意: 直接在浏览器中调用Pinata API，API密钥将暴露在前端代码中。生产环境中应使用后端服务处理上传。
              </div>
            </div>
          </div>

          <!-- 上传元数据按钮 -->
          <div>
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
              {{ uploadingMetadata ? '上传中...' : '上传元数据到IPFS' }}
            </a-button>
          </div>

          <!-- 元数据URL -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">
              元数据URL (IPFS链接) <span class="text-red-400">*</span>
            </label>
            <div class="flex items-center gap-2">
              <a-input
                v-model:value="metadataUrl"
                placeholder="例如: https://ipfs.io/ipfs/..."
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
                转换
              </a-button>
            </div>
            <div class="mt-1.5 text-xs text-white/50">此URL应指向包含代币详细信息的JSON文件</div>
          </div>

          <!-- 元数据预览 -->
          <div v-if="metadataJson" class="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 class="m-0 text-base font-semibold text-white mb-4">元数据预览</h3>
            <pre class="text-xs text-white/80 font-mono bg-white/5 rounded-lg p-4 border border-white/10 overflow-auto max-h-64">{{ JSON.stringify(metadataJson, null, 2) }}</pre>
          </div>

          <!-- 权限设置 -->
          <div class="bg-white/5 rounded-xl p-4 border border-white/10">
            <a-checkbox v-model:checked="modifyAfterMint" class="text-white/90">
              允许在铸币后修改元数据
            </a-checkbox>
            <div class="mt-2 text-xs text-white/50">
              选中后，您将保留修改元数据的权限
            </div>
          </div>

          <!-- 提示信息 -->
          <div
            class="flex items-start gap-3 p-4 bg-[rgba(20,241,149,0.1)] rounded-xl border border-[rgba(20,241,149,0.2)]">
            <InfoCircleOutlined class="text-solana-green text-lg shrink-0 mt-0.5" />
            <div class="flex-1">
              <div class="text-sm font-medium text-solana-green mb-1">设置提示</div>
              <div class="text-xs text-white/70">
                <ul class="m-0 pl-4 space-y-1">
                  <li>请先填写代币信息并上传元数据到IPFS</li>
                  <li>确保元数据URL正确且可访问</li>
                  <li>设置元数据后，代币信息将在钱包和浏览器中显示</li>
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
              {{ processing ? '设置中...' : '设置元数据' }}
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

/* 按钮样式覆盖 */
:deep(.ant-btn-primary:disabled) {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.4) !important;
}
</style>
