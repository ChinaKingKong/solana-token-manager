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
import { InboxOutlined, EditOutlined, SyncOutlined } from '@ant-design/icons-vue';

// Pinata API 配置
const pinataApiKey = ref('e73b97c7028f4e3ddc10');
const pinataSecretApiKey = ref('f2a5f9118d39b9ff463deb5c77165cb98dfafc5deed9f20e00608bf7b5b13c53');
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
  } else {
    // 如果是编辑模式，保持上传状态和内容
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
    if (isUpdatingContent && originalCID.value) { // 确保originalCID不为null
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
        // 使用类型断言解决TypeScript错误
        const updateResult = result as { actualUrl?: string };
        if (updateResult.actualUrl) {
          const newUrl = updateResult.actualUrl;
          // 保存实际新URL，以便显示给用户
          localStorage.setItem('lastActualNewUrl', newUrl);
          actualNewUrl.value = newUrl;
        }
      } else {
        // 清除之前的实际新URL
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
const copyUrl = () => {
  navigator.clipboard.writeText(uploadedUrl.value)
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
  navigator.clipboard.writeText(actualNewUrl.value)
    .then(() => {
      message.success('已复制新链接到剪贴板');
    })
    .catch(() => {
      message.error('复制失败');
    });
};

// 使用新链接替换当前链接
const useNewLink = () => {
  uploadedUrl.value = actualNewUrl.value;
  actualNewUrl.value = '';
  localStorage.removeItem('lastActualNewUrl');
  message.success('已切换到新链接');
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
  name: 'IPFSUploader'
});
</script>

<template>
  <div class="ipfs-uploader">
    <h2>上传到IPFS</h2>
    
    <div class="upload-info">
      <a-alert type="info" show-icon>
        <template #message>上传说明</template>
        <template #description>
          您可以选择以下任一方式上传文件到IPFS:
          <ul>
            <li>直接选择本地文件上传</li>
            <li>在编辑器中创建JSON内容上传</li>
          </ul>
          上传成功后，您将获得一个IPFS链接，可用于代币的Metadata设置。
        </template>
      </a-alert>
    </div>
    
    <!-- Pinata API配置 -->
    <div class="pinata-config">
      <h3>Pinata IPFS配置</h3>
      <a-form-item label="Pinata API Key">
        <a-input v-model:value="pinataApiKey" placeholder="输入你的Pinata API Key" />
      </a-form-item>
      
      <a-form-item label="Pinata Secret API Key">
        <a-input 
          v-model:value="pinataSecretApiKey" 
          placeholder="输入你的Pinata Secret API Key"
          type="password"
        />
      </a-form-item>
      
      <a-button 
        type="primary" 
        :loading="validatingApiKey" 
        @click="validateApiKey"
      >
        验证API密钥
      </a-button>
      <div class="form-hint">注意: 直接在浏览器中调用Pinata API，API密钥将暴露在前端代码中。生产环境中应使用后端服务处理上传。</div>
    </div>
    
    <div class="upload-methods">
      <a-radio-group v-model:value="uploadMode" button-style="solid">
        <a-radio-button value="file">文件上传模式</a-radio-button>
        <a-radio-button value="json">JSON编辑模式</a-radio-button>
      </a-radio-group>
    </div>
    
    <!-- 文件上传模式 -->
    <div v-if="uploadMode === 'file'" class="upload-container">
      <a-upload-dragger
        v-model:fileList="fileList"
        :beforeUpload="beforeUpload"
        @change="handleFileChange"
        :multiple="false"
        :showUploadList="true"
        accept="image/*,application/json"
        :customRequest="() => {}"
      >
        <p class="ant-upload-drag-icon">
          <inbox-outlined />
        </p>
        <p class="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p class="ant-upload-hint">
          支持单个文件，如图片或JSON文件。文件大小不超过10MB。
        </p>
      </a-upload-dragger>
      
      <div class="upload-action">
        <a-button 
          type="primary" 
          :loading="uploading" 
          @click="handleFileUpload"
          :disabled="fileList.length === 0"
        >
          上传到IPFS
        </a-button>
      </div>
    </div>
    
    <!-- JSON编辑模式 -->
    <div v-else class="upload-container">
      <a-textarea
        v-model:value="jsonContent"
        :rows="10"
        placeholder="请输入JSON内容"
      />
      
      <div v-if="isEditingUploadedJson" class="update-options">
        <a-checkbox v-model:checked="keepOriginalUrl">
          保持原URL不变（更新内容）
        </a-checkbox>
        <div class="form-hint">
          <p>选择此项将更新内容但保持原URL不变，取消选择将生成新URL</p>
          <p><b>重要说明</b>：保持URL不变时，新内容将上传到新的CID，但我们会返回原始URL。这意味着：</p>
          <ol>
            <li>如果您的应用已缓存了原URL的内容，可能需要刷新缓存</li>
            <li>某些IPFS网关可能需要一段时间才能显示更新后的内容</li>
            <li>如果您需要立即看到更新的内容，请取消选择此选项</li>
          </ol>
        </div>
      </div>
      
      <div class="upload-action">
        <a-button 
          type="primary" 
          :loading="uploading" 
          @click="handleJsonUpload"
        >
          {{ isEditingUploadedJson ? '更新到IPFS' : '上传到IPFS' }}
        </a-button>
      </div>
    </div>
    
    <!-- 上传结果 -->
    <div v-if="uploadStatus === 'success'" class="upload-result">
      <a-alert type="success" message="上传成功!" show-icon />
      
      <div class="ipfs-url">
        <a-input :value="uploadedUrl" readonly />
        <div class="url-actions">
          <a-button type="primary" @click="copyUrl">复制链接</a-button>
          <a-button @click="convertToIpfsIo" v-if="uploadedUrl.includes('mypinata.cloud')">
            转换为IPFS.io链接
          </a-button>
        </div>
      </div>
      
      <!-- 显示实际新URL（如果有） -->
      <div v-if="actualNewUrl" class="actual-url">
        <h4>实际新URL (内容已更新)</h4>
        <a-input :value="actualNewUrl" readonly />
        <div class="url-actions">
          <a-button type="primary" @click="copyActualNewUrl">复制新链接</a-button>
          <a-button type="dashed" @click="useNewLink">使用新链接</a-button>
        </div>
        <div class="form-hint">
          这是内容更新后的实际新URL。如果您需要立即访问更新后的内容，请使用此链接。
        </div>
      </div>
      
      <!-- 已上传的JSON内容 -->
      <div v-if="uploadedJsonContent !== null" class="uploaded-json">
        <div class="json-header">
          <h3>已上传的JSON内容</h3>
          <a-button 
            type="primary" 
            @click="editUploadedJson"
          >
            <template #icon><EditOutlined /></template>
            编辑并重新上传
          </a-button>
        </div>
        <pre class="json-preview">{{ JSON.stringify(uploadedJsonContent, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ipfs-uploader {
  padding: 20px;
  background: #fff;
  border-radius: 4px;
}

.upload-info {
  margin-bottom: 20px;
}

.pinata-config {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.02);
}

.form-hint {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-top: 8px;
}

.update-options {
  margin: 15px 0;
  padding: 10px;
  border: 1px dashed rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  background-color: rgba(0, 100, 255, 0.05);
}

.upload-methods {
  margin: 20px 0;
}

.upload-container {
  margin-top: 20px;
}

.upload-action {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.upload-result {
  margin-top: 30px;
}

.ipfs-url {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.url-actions {
  display: flex;
  gap: 10px;
}

.actual-url {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  background-color: rgba(255, 244, 230, 0.4);
}

.uploaded-json {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.02);
}

.json-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.json-preview {
  white-space: pre-wrap;
}
</style> 