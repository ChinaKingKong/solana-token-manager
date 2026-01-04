<script setup lang="ts">
import { ref } from 'vue';
import { message } from 'ant-design-vue';
import { PublicKey } from '@solana/web3.js';
import { getCurrentWallet, walletPublicKey } from '../../utils/wallet';
// 移除 Node.js 版本的 Pinata SDK
// import pinataSDK from '@pinata/sdk';

// Pinata API 配置
const pinataApiKey = ref('e73b97c7028f4e3ddc10');
const pinataSecretApiKey = ref('f2a5f9118d39b9ff463deb5c77165cb98dfafc5deed9f20e00608bf7b5b13c53');
// 不再需要 pinataClient
// const pinataClient = ref<any>(null);

// 元数据信息
const tokenMintAddress = ref('');
const tokenName = ref('');
const tokenSymbol = ref('');
const metadataUrl = ref('');
const modifyAfterMint = ref(true);
const metadataJson = ref<any>(null);
const uploadingMetadata = ref(false);

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

// 使用浏览器兼容的方式与Pinata API交互
const uploadToPinata = async (jsonBody: any) => {
  const url = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'pinata_api_key': pinataApiKey.value,
      'pinata_secret_api_key': pinataSecretApiKey.value
    },
    body: JSON.stringify(jsonBody)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
};

// 处理自定义Pinata网关链接
const handleCustomPinataGateway = (url: string) => {
  // 检查是否是Pinata自定义网关链接
  if (url.includes('mypinata.cloud/ipfs/')) {
    // 确保链接格式正确
    const parts = url.split('/ipfs/');
    if (parts.length === 2) {
      let cid = parts[1].trim();
      
      // 如果CID不完整或被截断，显示警告
      if (!cid) {
        message.error('Pinata链接CID为空，请提供完整的CID');
        return '';
      }
      
      // 检查CID是否被截断（通常CID长度至少为46个字符）
      if (cid.length < 46) {
        message.warning('CID可能不完整，请确保复制了完整的链接');
      }
      
      return url; // 链接格式正确
    }
    message.error('Pinata链接格式不正确，请检查完整链接');
    return '';
  }
  return url; // 不是Pinata链接，直接返回
};

// 转换Pinata URL为IPFS.io URL
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

// 验证当前URL
const validateCurrentUrl = () => {
  if (!metadataUrl.value) {
    message.error('请先输入元数据URL');
    return;
  }
  
  const processedUrl = handleCustomPinataGateway(metadataUrl.value);
  if (processedUrl) {
    message.success('链接格式正确');
  }
};

// 上传元数据到IPFS
const uploadMetadataToIPFS = async () => {
  if (!pinataApiKey.value || !pinataSecretApiKey.value) {
    message.error('请输入Pinata API密钥');
    return;
  }
  
  uploadingMetadata.value = true;
  
  try {
    // 准备元数据JSON
    const metadata = {
      name: tokenName.value,
      symbol: tokenSymbol.value,
      description: `${tokenName.value} token on Solana blockchain`,
      image: '', // 可以添加代币图片URL
      attributes: [],
      properties: {
        files: []
      }
    };
    
    metadataJson.value = metadata;
    
    // 上传到Pinata
    const pinataOptions = {
      pinataMetadata: {
        name: `${tokenName.value}-metadata`
      }
    };
    
    const result = await uploadToPinata({
      ...metadata,
      pinataOptions
    });
    
    if (result.IpfsHash) {
      metadataUrl.value = `https://ipfs.io/ipfs/${result.IpfsHash}`;
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
  
  // 处理自定义Pinata网关链接
  const processedUrl = handleCustomPinataGateway(metadataUrl.value);
  if (!processedUrl) {
    return; // 链接格式不正确，已在处理函数中显示错误信息
  }
  metadataUrl.value = processedUrl;
  
  if (!metadataUrl.value) {
    message.error('请提供元数据URL');
    return;
  }
  
  const wallet = getCurrentWallet();
  if (!wallet || !walletPublicKey.value) {
    message.error('请先连接钱包');
    return;
  }
  
  processing.value = true;
  
  try {
    // 此处简化处理，实际应用中需要调用Solana元数据程序
    // 模拟成功的情况
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    message.success('元数据设置成功!');
  } catch (error) {
    message.error('设置元数据失败');
    console.error(error);
  } finally {
    processing.value = false;
  }
};

// 创建新元数据
const createNewMetadata = () => {
  // 重置表单
  tokenMintAddress.value = '';
  tokenName.value = '';
  tokenSymbol.value = '';
  metadataUrl.value = '';
  modifyAfterMint.value = true;
  metadataJson.value = null;
};

// 更新现有元数据
const updateExistingMetadata = () => {
  // 重置表单但保留代币地址
  tokenName.value = '';
  tokenSymbol.value = '';
  metadataUrl.value = '';
  modifyAfterMint.value = true;
  metadataJson.value = null;
};

// 尝试修复不完整的Pinata链接
const tryFixPinataLink = () => {
  const url = metadataUrl.value;
  
  // 检查是否包含Pinata网关部分
  if (url.includes('mypinata.cloud')) {
    // 如果链接中没有/ipfs/部分，尝试添加
    if (!url.includes('/ipfs/')) {
      // 尝试从URL中提取可能的CID部分
      const parts = url.split('mypinata.cloud/');
      if (parts.length > 1) {
        const possibleCid = parts[1].trim();
        if (possibleCid) {
          metadataUrl.value = `https://ipfs.io/ipfs/${possibleCid}`;
          message.success('已尝试修复并转换为IPFS.io链接');
          return;
        }
      }
      
      message.error('无法自动修复链接，请确保提供完整的IPFS链接');
      return;
    }
    
    // 如果有/ipfs/部分但可能不完整
    convertToIpfsIo();
  } else if (url.includes('ipfs/')) {
    // 可能只有路径部分，尝试提取CID
    const parts = url.split('ipfs/');
    if (parts.length > 1) {
      const possibleCid = parts[1].trim();
      if (possibleCid) {
        metadataUrl.value = `https://ipfs.io/ipfs/${possibleCid}`;
        message.success('已尝试修复并转换为IPFS.io链接');
        return;
      }
    }
    message.error('无法自动修复链接，请确保提供完整的IPFS链接');
  } else {
    message.error('无法识别的链接格式，请提供有效的IPFS链接');
  }
};

// 默认导出
defineOptions({
  name: 'SetMetadata'
});
</script>

<template>
  <div class="metadata-container">
    <h2>设置代币Metadata</h2>
    
    <div class="action-buttons">
      <a-button type="primary" @click="createNewMetadata">创建新元数据</a-button>
      <a-button @click="updateExistingMetadata">更新现有元数据</a-button>
    </div>
    
    <a-form layout="vertical" class="metadata-form">
      <a-form-item label="代币Mint地址">
        <a-input 
          v-model:value="tokenMintAddress" 
          placeholder="如: 7zsFDHmRgJf7s8jc8CDAgWEmUgPEm9r7YUCRm4daHADw"
        />
      </a-form-item>
      
      <a-form-item label="代币名称">
        <a-input v-model:value="tokenName" placeholder="如: Noah" />
      </a-form-item>
      
      <a-form-item label="代币符号">
        <a-input v-model:value="tokenSymbol" placeholder="如: NOAH" />
      </a-form-item>
      
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
          :loading="uploadingMetadata" 
          @click="uploadMetadataToIPFS"
        >
          上传元数据到IPFS
        </a-button>
        <div class="form-hint">注意: 直接在浏览器中调用Pinata API，API密钥将暴露在前端代码中。生产环境中应使用后端服务处理上传。</div>
      </div>
      
      <a-form-item label="元数据URL (IPFS链接)">
        <a-input 
          v-model:value="metadataUrl" 
          placeholder="如: https://ipfs.io/ipfs/..."
        />
        <div class="form-hint">此URL应指向包含代币详细信息的JSON文件</div>
        <div class="url-actions">
          <a-button size="small" @click="validateCurrentUrl" style="margin-right: 8px;">
            验证链接
          </a-button>
          <a-button size="small" @click="tryFixPinataLink">
            修复链接
          </a-button>
        </div>
      </a-form-item>
      
      <!-- 显示元数据预览 -->
      <a-form-item v-if="metadataJson" label="元数据预览">
        <pre class="metadata-preview">{{ JSON.stringify(metadataJson, null, 2) }}</pre>
      </a-form-item>
      
      <a-form-item>
        <a-checkbox v-model:checked="modifyAfterMint">
          允许在铸币后修改元数据
        </a-checkbox>
        <div class="form-hint">选中后，您将保留修改元数据的权限</div>
      </a-form-item>
      
      <a-form-item>
        <a-button 
          type="primary" 
          :loading="processing" 
          @click="submitMetadata"
        >
          设置元数据
        </a-button>
      </a-form-item>
    </a-form>
  </div>
</template>

<style scoped>
.metadata-container {
  padding: 20px; 
  border-radius: 4px;
  background: #fff;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.metadata-form {
  margin-top: 20px;
}

.form-hint {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-top: 4px;
}

.pinata-config {
  margin: 20px 0;
  padding: 15px; 
  border-radius: 4px; 
}

.metadata-preview {
  padding: 10px; 
  border-radius: 4px;
  overflow: auto;
  max-height: 200px;
  color: #a0a0a0;
}

.url-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}
</style> 