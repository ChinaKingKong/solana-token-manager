// 模拟IPFS上传功能
// 在实际应用中，你需要使用真实的IPFS服务，如Pinata、Infura IPFS或自托管IPFS节点

// 实现使用Pinata API上传到IPFS

// Pinata API配置
const PINATA_API_URL = 'https://api.pinata.cloud';

// 上传文件到IPFS
export const uploadFileToIPFS = async (
  file: File, 
  apiKey: string, 
  secretApiKey: string
): Promise<{ success: boolean; url?: string; error?: any }> => {
  try {
    // 创建FormData对象
    const formData = new FormData();
    formData.append('file', file);
    
    // 添加Pinata元数据
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        uploadedAt: new Date().toISOString()
      }
    });
    formData.append('pinataMetadata', metadata);
    
    // 添加Pinata选项
    const options = JSON.stringify({
      cidVersion: 1
    });
    formData.append('pinataOptions', options);
    
    // 发送请求
    const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': secretApiKey
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    return {
      success: true,
      url: `https://ipfs.io/ipfs/${result.IpfsHash}`
    };
  } catch (error) {
    console.error('上传文件到IPFS失败:', error);
    return {
      success: false,
      error
    };
  }
};

// 上传JSON数据到IPFS
export const uploadJSONToIPFS = async (
  data: any,
  apiKey: string,
  secretApiKey: string
): Promise<{ success: boolean; url?: string; error?: any }> => {
  try {
    // 发送请求
    const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': secretApiKey
      },
      body: JSON.stringify({
        pinataContent: data,
        pinataMetadata: {
          name: data.name || 'json-metadata',
          keyvalues: {
            uploadedAt: new Date().toISOString()
          }
        },
        pinataOptions: {
          cidVersion: 1
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    return {
      success: true,
      url: `https://ipfs.io/ipfs/${result.IpfsHash}`
    };
  } catch (error) {
    console.error('上传JSON到IPFS失败:', error);
    return {
      success: false,
      error
    };
  }
};

// 验证Pinata API密钥
export const validatePinataCredentials = async (
  apiKey: string,
  secretApiKey: string
): Promise<boolean> => {
  try {
    const response = await fetch(`${PINATA_API_URL}/data/testAuthentication`, {
      method: 'GET',
      headers: {
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': secretApiKey
      }
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.message === 'Congratulations! You are communicating with the Pinata API!';
  } catch (error) {
    console.error('验证Pinata API密钥失败:', error);
    return false;
  }
};

// 生成随机的IPFS CID (Content Identifier)
const generateRandomCID = (): string => {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'bafkreib';
  
  // 生成一个随机的40字符的字符串作为CID的一部分
  for (let i = 0; i < 40; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
};

// 通过CID更新IPFS内容
export const updateIPFSContent = async (
  cid: string,
  data: any,
  apiKey: string,
  secretApiKey: string
): Promise<{ success: boolean; url?: string; error?: any; actualUrl?: string; originalCID?: string; newCID?: string }> => {
  try {
    // 在Pinata中，无法直接更新现有CID的内容
    // 我们需要先解析CID，然后上传新内容，并使用相同的文件名
    
    // 上传新内容
    const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': secretApiKey
      },
      body: JSON.stringify({
        pinataContent: data,
        pinataMetadata: {
          name: `updated-${cid}`, // 使用原始CID作为名称的一部分
          keyvalues: {
            originalCID: cid,
            updatedAt: new Date().toISOString()
          }
        },
        pinataOptions: {
          cidVersion: 1
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    // 尝试解除原始CID的固定
    try {
      await fetch(`${PINATA_API_URL}/pinning/unpin/${cid}`, {
        method: 'DELETE',
        headers: {
          'pinata_api_key': apiKey,
          'pinata_secret_api_key': secretApiKey
        }
      });
    } catch (unpinError) {
      console.warn('解除原始CID固定失败:', unpinError);
      // 继续执行，不中断流程
    }
    
    // 返回原始URL，而不是新URL
    return {
      success: true,
      url: `https://ipfs.io/ipfs/${cid}`, // 使用原始CID构建URL
      originalCID: cid,
      newCID: result.IpfsHash,
      actualUrl: `https://ipfs.io/ipfs/${result.IpfsHash}` // 保存实际的新URL，但不使用它
    };
  } catch (error) {
    console.error('更新IPFS内容失败:', error);
    return {
      success: false,
      error
    };
  }
};

// 从IPFS URL中提取CID
export const extractCIDFromURL = (url: string): string | null => {
  if (!url) return null;
  
  // 处理ipfs.io格式
  if (url.includes('ipfs.io/ipfs/')) {
    const parts = url.split('/ipfs/');
    if (parts.length >= 2) {
      return parts[1].split('/')[0].trim();
    }
  }
  
  // 处理Pinata格式
  if (url.includes('mypinata.cloud/ipfs/')) {
    const parts = url.split('/ipfs/');
    if (parts.length >= 2) {
      return parts[1].split('/')[0].trim();
    }
  }
  
  // 处理ipfs://格式
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', '').split('/')[0].trim();
  }
  
  return null;
}; 