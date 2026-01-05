<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import type { UploadProps } from 'ant-design-vue';

const { t } = useI18n();
import { 
  uploadFileToIPFS, 
  uploadJSONToIPFS, 
  validatePinataCredentials, 
  updateIPFSContent,
  extractCIDFromURL
} from '../../utils/ipfs';
import {
  InboxOutlined,
  EditOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  GlobalOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue';

// Pinata API 配置
const authMode = ref<'jwt' | 'apiKey'>('apiKey'); // 默认使用 API Key + Secret（推荐）
const pinataJwt = ref('');
const pinataApiKey = ref('');
const pinataSecretApiKey = ref('');
const apiKeyValid = ref(false);
const validatingApiKey = ref(false);

// 上传模式
const uploadMode = ref<'file' | 'json'>('file');

// 文件上传相关
const fileList = ref<any[]>([]);
const uploading = ref(false);
const uploadStatus = ref<'idle' | 'uploading' | 'success' | 'error'>('idle');
const uploadedUrl = ref('');
const originalCID = ref<string | null>(null);

// JSON编辑模式相关
const jsonContent = ref('{\n  "name": "Token Name",\n  "symbol": "SYMBOL",\n  "description": "Token description",\n  "image": "ipfs://your-image-cid"\n}');
const uploadedJsonContent = ref<any>(null);
const isEditingUploadedJson = ref(false);
const keepOriginalUrl = ref(true);

// 组件状态
const actualNewUrl = ref('');

// JSON 示例内容（避免在国际化字符串中使用 JSON，防止 vue-i18n 解析错误）
const jsonExample = `{
  "name": "Token Name",
  "symbol": "SYMBOL",
  "description": "Token description",
  "image": "ipfs://your-image-cid"
}`;

// 验证Pinata API密钥或JWT
const validateApiKey = async () => {
  if (authMode.value === 'jwt') {
    if (!pinataJwt.value) {
      message.error(t('ipfsUpload.jwtRequired'));
      apiKeyValid.value = false;
      return false;
    }
  } else {
  if (!pinataApiKey.value || !pinataSecretApiKey.value) {
      message.error(t('ipfsUpload.apiKeyRequired'));
    apiKeyValid.value = false;
    return false;
    }
  }
  
  validatingApiKey.value = true;
  
  try {
    const isValid = authMode.value === 'jwt'
      ? await validatePinataCredentials(pinataJwt.value)
      : await validatePinataCredentials(pinataApiKey.value, pinataSecretApiKey.value);
    
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

// 处理已上传的JSON内容
const editUploadedJson = () => {
  // 先设置编辑模式标志，防止watch触发时重置状态
  isEditingUploadedJson.value = true;
  
  // 提取并保存原始CID
  if (uploadedUrl.value) {
    originalCID.value = extractCIDFromURL(uploadedUrl.value);
  }
  
  if (uploadedJsonContent.value) {
    // 将已上传的JSON内容设置到编辑器中
    jsonContent.value = JSON.stringify(uploadedJsonContent.value, null, 2);
    
    // 切换到JSON编辑模式
    uploadMode.value = 'json';
    
    message.info(t('ipfsUpload.editAndReupload'));
  } else {
    message.error(t('ipfsUpload.jsonContentRequired'));
    isEditingUploadedJson.value = false;
  }
};

// 处理上传模式变更
watch(uploadMode, () => {
  // 如果不是在编辑已上传的JSON，则重置上传状态
  if (!isEditingUploadedJson.value) {
    uploadStatus.value = 'idle';
    fileList.value = [];
    uploadedUrl.value = '';
    uploadedJsonContent.value = null;
    originalCID.value = null;
  }
});

// 文件上传前验证
const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const isLt10M = file.size / 1024 / 1024 < 10;
  if (!isLt10M) {
    message.error(t('ipfsUpload.fileRequired'));
  }
  // 阻止自动上传，返回 false 或 Upload.LIST_IGNORE
  return false;
};

// 处理文件变更
const handleFileChange = (info: any) => {
  let newFileList = [...info.fileList];
  newFileList = newFileList.slice(-1); // 只保留最后一个文件
  
  // 移除上传状态，只保留文件信息
  newFileList = newFileList.map(file => {
    if (file.status === 'uploading') {
      return {
        ...file,
        status: 'done' as const,
      };
    }
    return file;
  });
  
  fileList.value = newFileList;
};

// 处理文件上传
const handleFileUpload = async () => {
  if (fileList.value.length === 0) {
    message.error(t('ipfsUpload.fileRequired'));
    return;
  }
  
  // 验证API密钥
  if (!await validateApiKey()) {
    return;
  }
  
  uploading.value = true;
  uploadStatus.value = 'uploading';
  
  try {
    const file = fileList.value[0].originFileObj;
    const result = authMode.value === 'jwt'
      ? await uploadFileToIPFS(file, pinataJwt.value)
      : await uploadFileToIPFS(file, pinataApiKey.value, pinataSecretApiKey.value);
    
    if (result.success && result.url) {
      uploadedUrl.value = result.url;
      uploadStatus.value = 'success';
      
      // 如果是JSON文件，尝试解析内容
      if (file.type === 'application/json') {
        try {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const jsonData = JSON.parse(e.target?.result as string);
              uploadedJsonContent.value = jsonData;
            } catch (parseError) {
              // 解析JSON文件失败，静默处理
            }
          };
          reader.readAsText(file);
        } catch (fileError) {
          // 读取JSON文件失败，静默处理
        }
      } else {
        // 非JSON文件，清空JSON内容
        uploadedJsonContent.value = null;
      }
      
      message.success(t('ipfsUpload.uploadSuccess'));
    } else {
      uploadStatus.value = 'error';
      message.error(t('ipfsUpload.uploadFailed'));
    }
  } catch (error) {
    uploadStatus.value = 'error';
    message.error(t('ipfsUpload.uploadFailed'));
  } finally {
    uploading.value = false;
  }
};

// 处理JSON上传
const handleJsonUpload = async () => {
  if (!jsonContent.value.trim()) {
    message.error(t('ipfsUpload.jsonContentRequired'));
    return;
  }
  
  // 验证API密钥
  if (!await validateApiKey()) {
    return;
  }
  
  uploading.value = true;
  uploadStatus.value = 'uploading';
  
  try {
    // 验证JSON格式
    const jsonData = JSON.parse(jsonContent.value);
    
    let result;
    const isUpdatingContent = isEditingUploadedJson.value && keepOriginalUrl.value && originalCID.value;
    
    // 如果是编辑模式且选择保持原URL，则使用更新功能
    if (isUpdatingContent && originalCID.value) {
      result = authMode.value === 'jwt'
        ? await updateIPFSContent(originalCID.value, jsonData, pinataJwt.value)
        : await updateIPFSContent(originalCID.value, jsonData, pinataApiKey.value, pinataSecretApiKey.value);
    } else {
      // 否则使用常规上传
      result = authMode.value === 'jwt'
        ? await uploadJSONToIPFS(jsonData, pinataJwt.value)
        : await uploadJSONToIPFS(jsonData, pinataApiKey.value, pinataSecretApiKey.value);
    }
    
    if (result.success && result.url) {
      uploadedUrl.value = result.url;
      uploadedJsonContent.value = jsonData;
      
      // 保存实际新URL（如果有）
      if (isUpdatingContent) {
        const updateResult = result as { actualUrl?: string };
        if (updateResult.actualUrl) {
          const newUrl = updateResult.actualUrl;
          localStorage.setItem('lastActualNewUrl', newUrl);
          actualNewUrl.value = newUrl;
        }
      } else {
        localStorage.removeItem('lastActualNewUrl');
        actualNewUrl.value = '';
      }
      
      // 保存CID以便后续更新
      if (!isUpdatingContent) {
        const newCid = extractCIDFromURL(result.url);
        if (newCid) {
          originalCID.value = newCid;
        }
      }
      
      uploadStatus.value = 'success';
      
      if (isEditingUploadedJson.value) {
        if (keepOriginalUrl.value) {
          message.success(t('ipfsUpload.update'));
        } else {
          message.success(t('ipfsUpload.update'));
        }
        isEditingUploadedJson.value = false;
      } else {
        message.success(t('ipfsUpload.uploadSuccess'));
      }
    } else {
      uploadStatus.value = 'error';
      message.error(t('ipfsUpload.uploadFailed'));
    }
  } catch (error) {
    uploadStatus.value = 'error';
    if (error instanceof SyntaxError) {
      message.error(t('ipfsUpload.uploadFailed'));
    } else {
      message.error(t('ipfsUpload.uploadFailed'));
    }
  } finally {
    uploading.value = false;
  }
};

// 复制链接到剪贴板
const copyUrl = (url: string) => {
  navigator.clipboard.writeText(url)
    .then(() => {
      message.success(t('ipfsUpload.urlCopied'));
    })
    .catch(() => {
      message.error(t('common.error'));
    });
};

// 转换为IPFS.io链接
const convertToIpfsIo = () => {
  if (uploadedUrl.value.includes('mypinata.cloud/ipfs/')) {
    const parts = uploadedUrl.value.split('/ipfs/');
    if (parts.length === 2) {
      const cid = parts[1].trim();
      if (cid) {
        uploadedUrl.value = `https://ipfs.io/ipfs/${cid}`;
        message.success(t('ipfsUpload.convertToIpfsSuccess'));
        return;
      }
    }
    message.error(t('ipfsUpload.convertToIpfsFailed'));
  } else {
    message.info(t('ipfsUpload.convertToIpfsNotNeeded'));
  }
};

// 复制实际新URL到剪贴板
const copyActualNewUrl = () => {
  copyUrl(actualNewUrl.value);
};

// 使用新链接替换当前链接
const useNewLink = () => {
  uploadedUrl.value = actualNewUrl.value;
  actualNewUrl.value = '';
  localStorage.removeItem('lastActualNewUrl');
  message.success(t('ipfsUpload.switchToNewUrl'));
};

// 组件挂载时的初始化
onMounted(() => {
  uploadStatus.value = 'idle';
  isEditingUploadedJson.value = false;
  uploadedJsonContent.value = null;
  originalCID.value = null;
  
  // 从localStorage获取上次的实际新URL
  const lastActualNewUrl = localStorage.getItem('lastActualNewUrl');
  if (lastActualNewUrl) {
    actualNewUrl.value = lastActualNewUrl;
  }
});

// 默认导出
defineOptions({
  name: 'IPFSUploader',
});
</script>

<template>
  <div class="p-0 w-full max-w-full animate-[fadeIn_0.3s_ease-in] min-h-full flex flex-col">
    <div class="w-full py-3">
      <div
        class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border border-white/10 rounded-2xl p-6 overflow-visible transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(20,241,149,0.3)] hover:shadow-[0_8px_32px_rgba(20,241,149,0.15)]">
        <div
          class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
        </div>
        <div class="relative z-[1] space-y-6">
          <!-- 标题和说明 -->
          <div>
            <h2 class="m-0 text-2xl font-semibold text-white mb-2">{{ t('ipfsUpload.title') }}</h2>
            <div class="flex items-start gap-3 p-4 bg-[rgba(20,241,149,0.1)] rounded-xl border border-[rgba(20,241,149,0.2)]">
              <InfoCircleOutlined class="text-solana-green text-lg shrink-0 mt-0.5" />
              <div class="flex-1">
                <div class="text-sm font-medium text-solana-green mb-1">{{ t('ipfsUpload.uploadDescription') }}</div>
                <div class="text-xs text-white/70">
                  <ul class="m-0 pl-4 space-y-1">
                    <li>{{ t('ipfsUpload.uploadDescription1') }}</li>
                    <li>{{ t('ipfsUpload.uploadDescription2') }}</li>
                    <li>{{ t('ipfsUpload.uploadDescription3') }}</li>
          </ul>
                </div>
              </div>
            </div>
    </div>
    
    <!-- Pinata API配置 -->
          <div class="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 class="m-0 text-lg font-semibold text-white mb-4">{{ t('ipfsUpload.pinataConfig') }}</h3>
            <div class="space-y-4">
              <!-- 认证方式选择 -->
              <div>
                <label class="block text-sm font-medium text-white/90 mb-2">{{ t('ipfsUpload.authMode') }}</label>
                <a-radio-group v-model:value="authMode" button-style="solid" class="w-full">
                  <a-radio-button value="apiKey" class="flex-1">
                    {{ t('ipfsUpload.apiKeyMode') }}
                  </a-radio-button>
                  <a-radio-button value="jwt" class="flex-1">
                    {{ t('ipfsUpload.jwtMode') }}
                  </a-radio-button>
                </a-radio-group>
              </div>
              
              <!-- API Key + Secret 模式 -->
              <template v-if="authMode === 'apiKey'">
                <div>
                  <label class="block text-sm font-medium text-white/90 mb-2">
                    {{ t('ipfsUpload.pinataApiKey') }} <span class="text-red-400">*</span>
                  </label>
                  <a-input
                    v-model:value="pinataApiKey"
                    :placeholder="t('ipfsUpload.pinataApiKeyPlaceholder')"
                    size="large"
                    class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                    :class="{ '!border-solana-green': pinataApiKey }"
                  />
                </div>
      
                <div>
                  <label class="block text-sm font-medium text-white/90 mb-2">
                    {{ t('ipfsUpload.pinataSecretKey') }} <span class="text-red-400">*</span>
                  </label>
        <a-input 
          v-model:value="pinataSecretApiKey" 
                    :placeholder="t('ipfsUpload.pinataSecretKeyPlaceholder')"
                    type="password"
                    size="large"
                    class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                    :class="{ '!border-solana-green': pinataSecretApiKey }"
                  />
                </div>
                <div class="mt-2 text-xs text-white/60">
                  <span v-html="t('ipfsUpload.apiKeySecretDesc', { link: '<a href=\'https://app.pinata.cloud/\' target=\'_blank\' class=\'text-solana-green hover:underline\'>' + t('ipfsUpload.pinataAppLink') + '</a>' })"></span>
                </div>
              </template>
              
              <!-- JWT 模式 -->
              <div v-else>
                <label class="block text-sm font-medium text-white/90 mb-2">
                  {{ t('ipfsUpload.pinataJwt') }} <span class="text-red-400">*</span>
                </label>
                <a-input
                  v-model:value="pinataJwt"
                  :placeholder="t('ipfsUpload.pinataJwtPlaceholder')"
          type="password"
                  size="large"
                  class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                  :class="{ '!border-solana-green': pinataJwt }"
        />
                <div class="mt-2 text-xs text-white/60">
                  <span v-html="t('ipfsUpload.jwtDesc', { link: '<a href=\'https://app.pinata.cloud/\' target=\'_blank\' class=\'text-solana-green hover:underline\'>' + t('ipfsUpload.pinataAppLink') + '</a>' })"></span>
                </div>
              </div>
      
              <div class="flex items-center gap-3">
      <a-button 
        type="primary" 
        :loading="validatingApiKey" 
        @click="validateApiKey"
                  class="flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-2.5 h-auto text-[15px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300">
                  <template #icon>
                    <ReloadOutlined />
                  </template>
                  {{ t('ipfsUpload.validate') }}
      </a-button>
                <div v-if="apiKeyValid" class="flex items-center gap-2 text-green-400">
                  <CheckCircleOutlined />
                  <span class="text-sm">{{ t('ipfsUpload.validateSuccess') }}</span>
                </div>
              </div>
              
              <div class="text-xs text-white/50">
                {{ t('ipfsUpload.securityNote') }}
              </div>
            </div>
    </div>
    
          <!-- 上传模式选择 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">{{ t('ipfsUpload.uploadMode') }}</label>
            <a-radio-group v-model:value="uploadMode" button-style="solid" class="w-full">
              <a-radio-button value="file" class="flex-1">
                <template #icon>
                  <UploadOutlined />
                </template>
                {{ t('ipfsUpload.fileMode') }}
              </a-radio-button>
              <a-radio-button value="json" class="flex-1">
                <template #icon>
                  <EditOutlined />
                </template>
                {{ t('ipfsUpload.jsonMode') }}
              </a-radio-button>
      </a-radio-group>
    </div>
    
    <!-- 文件上传模式 -->
          <div v-if="uploadMode === 'file'">
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('ipfsUpload.selectFile') }} <span class="text-red-400">*</span>
            </label>
      <a-upload-dragger
        v-model:fileList="fileList"
        :beforeUpload="beforeUpload"
        @change="handleFileChange"
        :multiple="false"
              :showUploadList="{ showRemoveIcon: true, showPreviewIcon: false }"
        accept="image/*,application/json"
        :customRequest="() => {}"
              class="bg-white/5 border-white/20 rounded-xl"
      >
              <p class="ant-upload-drag-icon text-white/60">
                <InboxOutlined class="text-4xl" />
        </p>
              <p class="ant-upload-text text-white">{{ t('ipfsUpload.dragFileHere') }}</p>
              <p class="ant-upload-hint text-white/70">
                {{ t('ipfsUpload.supportSingleFile') }}
        </p>
      </a-upload-dragger>
      
            <div class="mt-4">
        <a-button 
          type="primary" 
          :loading="uploading" 
          @click="handleFileUpload"
                :disabled="fileList.length === 0 || !apiKeyValid"
                size="large"
                block
                class="flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-3 h-auto text-[16px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                <template #icon>
                  <UploadOutlined />
                </template>
                {{ uploading ? t('ipfsUpload.uploading') : t('ipfsUpload.upload') }}
        </a-button>
      </div>
    </div>
    
    <!-- JSON编辑模式 -->
          <div v-else>
            <label class="block text-sm font-medium text-white/90 mb-2">
              {{ t('ipfsUpload.jsonContent') }} <span class="text-red-400">*</span>
            </label>
      <a-textarea
        v-model:value="jsonContent"
              :rows="12"
              :placeholder="t('ipfsUpload.jsonContentPlaceholder') === '请输入JSON内容' ? `${t('ipfsUpload.jsonContentPlaceholder')}，例如：\n${jsonExample}` : `${t('ipfsUpload.jsonContentPlaceholder')}, e.g.:\n${jsonExample}`"
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl font-mono"
              :class="{ '!border-solana-green': jsonContent }"
      />
      
            <div v-if="isEditingUploadedJson" class="mt-4 p-4 bg-[rgba(250,173,20,0.1)] rounded-xl border border-[rgba(250,173,20,0.2)]">
              <a-checkbox v-model:checked="keepOriginalUrl" class="text-white/90">
                {{ t('ipfsUpload.keepOriginalUrl') }}
        </a-checkbox>
              <div class="mt-2 text-xs text-white/70">
                {{ t('ipfsUpload.keepOriginalUrlDesc') }}
        </div>
      </div>
      
            <div class="mt-4">
        <a-button 
          type="primary" 
          :loading="uploading" 
          @click="handleJsonUpload"
                :disabled="!apiKeyValid"
                size="large"
                block
                class="flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-3 h-auto text-[16px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                <template #icon>
                  <UploadOutlined />
                </template>
                {{ uploading ? t('ipfsUpload.uploading') : (isEditingUploadedJson ? t('ipfsUpload.update') : t('ipfsUpload.upload')) }}
        </a-button>
      </div>
    </div>
    
    <!-- 上传结果 -->
          <div v-if="uploadStatus === 'success'" class="space-y-4">
            <div class="flex items-center gap-3 p-4 bg-[rgba(82,196,26,0.1)] rounded-xl border border-[rgba(82,196,26,0.2)]">
              <CheckCircleOutlined class="text-[#52c41a] text-xl" />
              <div>
                <div class="text-sm font-medium text-[#52c41a]">{{ t('ipfsUpload.uploadSuccess') }}</div>
                <div class="text-xs text-white/70 mt-1">{{ t('ipfsUpload.uploadSuccess') }}</div>
              </div>
            </div>
            
            <!-- IPFS链接 -->
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-medium text-white/80">{{ t('ipfsUpload.title') }}</span>
              </div>
              <div class="flex items-center gap-2">
                <div
                  class="flex-1 px-4 py-2.5 bg-white/5 rounded-lg border border-white/10 text-sm font-mono text-white/90 break-all">
                  {{ uploadedUrl }}
                </div>
                <a-button
                  type="text"
                  @click="copyUrl(uploadedUrl)"
                  class="flex items-center justify-center text-white px-4 py-2.5 h-auto transition-all duration-300 ease-in-out hover:text-solana-green">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                  {{ t('common.copy') }}
                </a-button>
                <a-button
                  v-if="uploadedUrl.includes('mypinata.cloud')"
                  @click="convertToIpfsIo"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <GlobalOutlined />
                  </template>
                  {{ t('ipfsUpload.convert') }}
          </a-button>
        </div>
      </div>
      
            <!-- 实际新URL（如果有） -->
            <div v-if="actualNewUrl" class="bg-[rgba(250,173,20,0.1)] rounded-xl p-4 border border-[rgba(250,173,20,0.2)]">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-medium text-[#faad14]">{{ t('ipfsUpload.actualNewUrl') }}</span>
              </div>
              <div class="flex items-center gap-2 mb-2">
                <div
                  class="flex-1 px-4 py-2.5 bg-white/5 rounded-lg border border-white/10 text-sm font-mono text-white/90 break-all">
                  {{ actualNewUrl }}
                </div>
                <a-button
                  type="text"
                  @click="copyActualNewUrl"
                  class="flex items-center justify-center text-white px-4 py-2.5 h-auto transition-all duration-300 ease-in-out hover:text-solana-green">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                  {{ t('common.copy') }}
                </a-button>
                <a-button @click="useNewLink"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  {{ t('ipfsUpload.use') }}
                </a-button>
        </div>
              <div class="text-xs text-white/70">
                {{ t('ipfsUpload.actualNewUrlDesc') }}
        </div>
      </div>
      
      <!-- 已上传的JSON内容 -->
            <div v-if="uploadedJsonContent !== null" class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <h3 class="m-0 text-base font-semibold text-white">{{ t('ipfsUpload.uploadedJsonContent') }}</h3>
          <a-button 
                  type="text"
            @click="editUploadedJson"
                  class="flex items-center justify-center text-white px-4 py-2.5 h-auto transition-all duration-300 ease-in-out hover:text-solana-green">
                  <template #icon>
                    <EditOutlined />
                  </template>
                  {{ t('ipfsUpload.editAndReupload') }}
          </a-button>
              </div>
              <pre class="text-xs text-white/80 font-mono bg-white/5 rounded-lg p-4 border border-white/10 overflow-auto max-h-64">{{ JSON.stringify(uploadedJsonContent, null, 2) }}</pre>
            </div>
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
:deep(.ant-input-password input) {
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

/* 上传组件样式 */
:deep(.ant-upload-drag) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

:deep(.ant-upload-drag:hover) {
  border-color: rgba(20, 241, 149, 0.5) !important;
  background-color: rgba(255, 255, 255, 0.08) !important;
}

:deep(.ant-upload-text) {
  color: rgba(255, 255, 255, 1) !important;
}

:deep(.ant-upload-hint) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.ant-upload-list) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-upload-list-item) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

/* 调整附件图标左边距 */
:deep(.ant-upload-list-item-icon) {
  margin-left: 16px !important;
}

:deep(.ant-upload-list-item .anticon) {
  margin-left: 16px !important;
}

/* 隐藏上传列表中的上传图标和进度 */
:deep(.ant-upload-list-item-uploading) {
  pointer-events: none;
}

:deep(.ant-upload-list-item-uploading .ant-upload-icon) {
  display: none !important;
}

:deep(.ant-upload-list-item-uploading .anticon-loading) {
  display: none !important;
}

:deep(.ant-upload-list-item .ant-upload-list-item-progress) {
  display: none !important;
}

/* 文本按钮样式 */
:deep(.ant-btn-text) {
  background: transparent !important;
  border: none !important;
  color: rgba(255, 255, 255, 0.9) !important;
  padding: 0 !important;
  box-shadow: none !important;
}

:deep(.ant-btn-text:hover) {
  background: transparent !important;
  border: none !important;
  color: #14f195 !important;
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
