<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { message, Upload } from 'ant-design-vue';
import type { UploadProps } from 'ant-design-vue';
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
    
    message.info('已加载JSON内容到编辑器，您可以修改后重新上传');
  } else {
    console.error('没有可编辑的JSON内容');
    message.error('没有可编辑的JSON内容');
    isEditingUploadedJson.value = false;
  }
};

// 处理上传模式变更
watch(uploadMode, (newMode, oldMode) => {
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
    message.error('文件大小不能超过10MB!');
  }
  return isLt10M || Upload.LIST_IGNORE;
};

// 处理文件变更
const handleFileChange = (info: any) => {
  let newFileList = [...info.fileList];
  newFileList = newFileList.slice(-1); // 只保留最后一个文件
  fileList.value = newFileList;
};

// 处理文件上传
const handleFileUpload = async () => {
  if (fileList.value.length === 0) {
    message.error('请先选择要上传的文件');
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
    const result = await uploadFileToIPFS(
      file,
      pinataApiKey.value,
      pinataSecretApiKey.value
    );
    
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
              console.error('解析JSON文件失败:', parseError);
            }
          };
          reader.readAsText(file);
        } catch (fileError) {
          console.error('读取JSON文件失败:', fileError);
        }
      } else {
        // 非JSON文件，清空JSON内容
        uploadedJsonContent.value = null;
      }
      
      message.success('文件上传成功');
    } else {
      uploadStatus.value = 'error';
      message.error('文件上传失败');
    }
  } catch (error) {
    uploadStatus.value = 'error';
    message.error('上传过程中发生错误');
    console.error(error);
  } finally {
    uploading.value = false;
  }
};

// 处理JSON上传
const handleJsonUpload = async () => {
  if (!jsonContent.value.trim()) {
    message.error('JSON内容不能为空');
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
      result = await updateIPFSContent(
        originalCID.value,
        jsonData,
        pinataApiKey.value,
        pinataSecretApiKey.value
      );
    } else {
      // 否则使用常规上传
      result = await uploadJSONToIPFS(
        jsonData,
        pinataApiKey.value,
        pinataSecretApiKey.value
      );
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
          message.success('JSON内容已更新，URL保持不变');
        } else {
          message.success('JSON内容已更新并生成新URL');
        }
        isEditingUploadedJson.value = false;
      } else {
        message.success('JSON上传成功');
      }
    } else {
      uploadStatus.value = 'error';
      message.error('JSON上传失败');
    }
  } catch (error) {
    uploadStatus.value = 'error';
    if (error instanceof SyntaxError) {
      message.error('无效的JSON格式');
    } else {
      message.error('上传过程中发生错误');
    }
    console.error(error);
  } finally {
    uploading.value = false;
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
  if (uploadedUrl.value.includes('mypinata.cloud/ipfs/')) {
    const parts = uploadedUrl.value.split('/ipfs/');
    if (parts.length === 2) {
      const cid = parts[1].trim();
      if (cid) {
        uploadedUrl.value = `https://ipfs.io/ipfs/${cid}`;
        message.success('已转换为IPFS.io链接');
        return;
      }
    }
    message.error('无法转换链接，CID格式不正确');
  } else {
    message.info('当前不是Pinata链接，无需转换');
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
  message.success('已切换到新链接');
};

// 格式化地址
const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 20)}...${address.slice(-20)}`;
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
            <h2 class="m-0 text-2xl font-semibold text-white mb-2">上传到IPFS</h2>
            <div class="flex items-start gap-3 p-4 bg-[rgba(20,241,149,0.1)] rounded-xl border border-[rgba(20,241,149,0.2)]">
              <InfoCircleOutlined class="text-solana-green text-lg shrink-0 mt-0.5" />
              <div class="flex-1">
                <div class="text-sm font-medium text-solana-green mb-1">上传说明</div>
                <div class="text-xs text-white/70">
                  <ul class="m-0 pl-4 space-y-1">
                    <li>您可以选择文件上传或JSON编辑模式上传内容到IPFS</li>
                    <li>上传成功后，您将获得一个IPFS链接，可用于代币的Metadata设置</li>
                    <li>支持图片、JSON等文件类型，文件大小不超过10MB</li>
                  </ul>
                </div>
              </div>
            </div>
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
                  class="flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-2.5 h-auto text-[15px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300">
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

          <!-- 上传模式选择 -->
          <div>
            <label class="block text-sm font-medium text-white/90 mb-2">上传模式</label>
            <a-radio-group v-model:value="uploadMode" button-style="solid" class="w-full">
              <a-radio-button value="file" class="flex-1">
                <template #icon>
                  <UploadOutlined />
                </template>
                文件上传
              </a-radio-button>
              <a-radio-button value="json" class="flex-1">
                <template #icon>
                  <EditOutlined />
                </template>
                JSON编辑
              </a-radio-button>
            </a-radio-group>
          </div>

          <!-- 文件上传模式 -->
          <div v-if="uploadMode === 'file'">
            <label class="block text-sm font-medium text-white/90 mb-2">
              选择文件 <span class="text-red-400">*</span>
            </label>
            <a-upload-dragger
              v-model:fileList="fileList"
              :beforeUpload="beforeUpload"
              @change="handleFileChange"
              :multiple="false"
              :showUploadList="true"
              accept="image/*,application/json"
              :customRequest="() => {}"
              class="bg-white/5 border-white/20 rounded-xl"
            >
              <p class="ant-upload-drag-icon text-white/60">
                <InboxOutlined class="text-4xl" />
              </p>
              <p class="ant-upload-text text-white">点击或拖拽文件到此区域上传</p>
              <p class="ant-upload-hint text-white/70">
                支持单个文件，如图片或JSON文件。文件大小不超过10MB。
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
                {{ uploading ? '上传中...' : '上传到IPFS' }}
              </a-button>
            </div>
          </div>

          <!-- JSON编辑模式 -->
          <div v-else>
            <label class="block text-sm font-medium text-white/90 mb-2">
              JSON内容 <span class="text-red-400">*</span>
            </label>
            <a-textarea
              v-model:value="jsonContent"
              :rows="12"
              placeholder='请输入JSON内容，例如：\n{\n  "name": "Token Name",\n  "symbol": "SYMBOL",\n  "description": "Token description",\n  "image": "ipfs://your-image-cid"\n}'
              class="bg-white/5 border-white/20 text-white placeholder:text-white/40 rounded-xl font-mono"
              :class="{ '!border-solana-green': jsonContent }"
            />
            
            <div v-if="isEditingUploadedJson" class="mt-4 p-4 bg-[rgba(250,173,20,0.1)] rounded-xl border border-[rgba(250,173,20,0.2)]">
              <a-checkbox v-model:checked="keepOriginalUrl" class="text-white/90">
                保持原URL不变（更新内容）
              </a-checkbox>
              <div class="mt-2 text-xs text-white/70">
                选择此项将更新内容但保持原URL不变，取消选择将生成新URL
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
                {{ uploading ? '上传中...' : (isEditingUploadedJson ? '更新到IPFS' : '上传到IPFS') }}
              </a-button>
            </div>
          </div>

          <!-- 上传结果 -->
          <div v-if="uploadStatus === 'success'" class="space-y-4">
            <div class="flex items-center gap-3 p-4 bg-[rgba(82,196,26,0.1)] rounded-xl border border-[rgba(82,196,26,0.2)]">
              <CheckCircleOutlined class="text-[#52c41a] text-xl" />
              <div>
                <div class="text-sm font-medium text-[#52c41a]">上传成功！</div>
                <div class="text-xs text-white/70 mt-1">您的文件已成功上传到IPFS</div>
              </div>
            </div>
            
            <!-- IPFS链接 -->
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-medium text-white/80">IPFS链接</span>
              </div>
              <div class="flex items-center gap-2">
                <div
                  class="flex-1 px-4 py-2.5 bg-white/5 rounded-lg border border-white/10 text-sm font-mono text-white/90 break-all">
                  {{ uploadedUrl }}
                </div>
                <a-button @click="copyUrl(uploadedUrl)"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                  复制
                </a-button>
                <a-button
                  v-if="uploadedUrl.includes('mypinata.cloud')"
                  @click="convertToIpfsIo"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <GlobalOutlined />
                  </template>
                  转换
                </a-button>
              </div>
            </div>
            
            <!-- 实际新URL（如果有） -->
            <div v-if="actualNewUrl" class="bg-[rgba(250,173,20,0.1)] rounded-xl p-4 border border-[rgba(250,173,20,0.2)]">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-medium text-[#faad14]">实际新URL (内容已更新)</span>
              </div>
              <div class="flex items-center gap-2 mb-2">
                <div
                  class="flex-1 px-4 py-2.5 bg-white/5 rounded-lg border border-white/10 text-sm font-mono text-white/90 break-all">
                  {{ actualNewUrl }}
                </div>
                <a-button @click="copyActualNewUrl"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                  复制
                </a-button>
                <a-button @click="useNewLink"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  使用
                </a-button>
              </div>
              <div class="text-xs text-white/70">
                这是内容更新后的实际新URL。如果您需要立即访问更新后的内容，请使用此链接。
              </div>
            </div>
            
            <!-- 已上传的JSON内容 -->
            <div v-if="uploadedJsonContent !== null" class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center justify-between mb-4">
                <h3 class="m-0 text-base font-semibold text-white">已上传的JSON内容</h3>
                <a-button
                  type="primary"
                  @click="editUploadedJson"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-4 py-2.5 h-auto rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <EditOutlined />
                  </template>
                  编辑并重新上传
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
