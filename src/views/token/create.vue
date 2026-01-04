<script setup lang="ts">
import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import { PublicKey } from '@solana/web3.js';
import { createNewToken } from '../../utils/token';
import { getCurrentWallet, walletPublicKey } from '../../utils/wallet';

// 代币信息
const tokenName = ref('');
const tokenSymbol = ref('');
const tokenDecimals = ref(9);
const keepMintAuthority = ref(true);
const keepFreezeAuthority = ref(true);

// 状态
const creating = ref(false);
const createdTokenMint = ref('');

// 验证函数
const isFormValid = computed(() => {
  return tokenDecimals.value >= 0 && 
         tokenDecimals.value <= 9 && 
         walletPublicKey.value !== null;
});

// 创建代币
const createToken = async () => {
  if (!isFormValid.value) {
    message.error('请检查表单信息是否正确');
    return;
  }
  
  const wallet = getCurrentWallet();
  if (!wallet || !walletPublicKey.value) {
    message.error('请先连接钱包');
    return;
  }
  
  creating.value = true;
  
  try {
    const mintAuthority = keepMintAuthority.value 
      ? walletPublicKey.value 
      : null;
    
    const freezeAuthority = keepFreezeAuthority.value 
      ? walletPublicKey.value 
      : null;
    
    const result = await createNewToken(
      wallet,
      walletPublicKey.value,
      freezeAuthority,
      tokenDecimals.value
    );
    
    if (result.success) {
      createdTokenMint.value = result.tokenMint;
      message.success('代币创建成功!');
    } else {
      message.error('创建代币失败');
      console.error(result.error);
    }
  } catch (error) {
    message.error('创建代币出错');
    console.error(error);
  } finally {
    creating.value = false;
  }
};

// 默认导出
defineOptions({
  name: 'TokenCreate'
});
</script>

<template>
  <div class="create-token-container">
    <h2>创建新代币</h2>
    
    <div v-if="createdTokenMint" class="success-message">
      <a-alert 
        message="代币创建成功!" 
        description="您的代币Mint地址如下，请妥善保存。" 
        type="success" 
        show-icon
      />
      <div class="token-mint-address">
        <a-input :value="createdTokenMint" readonly />
        <a-button 
          type="primary" 
          @click="() => { navigator.clipboard.writeText(createdTokenMint); message.success('已复制到剪贴板'); }"
        >
          复制地址
        </a-button>
      </div>
    </div>
    
    <a-form v-else layout="vertical">
      <a-form-item label="代币名称">
        <a-input v-model:value="tokenName" placeholder="例如: My Token" />
      </a-form-item>
      
      <a-form-item label="代币符号">
        <a-input v-model:value="tokenSymbol" placeholder="例如: MTK" />
      </a-form-item>
      
      <a-form-item label="小数位数">
        <a-input-number 
          v-model:value="tokenDecimals" 
          :min="0" 
          :max="9" 
          style="width: 100%"
        />
        <div class="form-hint">设置代币的小数位数，范围0-9，推荐使用9</div>
      </a-form-item>
      
      <a-form-item>
        <a-checkbox v-model:checked="keepMintAuthority">保留铸币权限</a-checkbox>
        <div class="form-hint">如果保留铸币权限，您可以在之后铸造更多的代币</div>
      </a-form-item>
      
      <a-form-item>
        <a-checkbox v-model:checked="keepFreezeAuthority">保留冻结权限</a-checkbox>
        <div class="form-hint">如果保留冻结权限，您可以在之后冻结任何代币账户</div>
      </a-form-item>
      
      <a-form-item>
        <a-button 
          type="primary" 
          :loading="creating" 
          :disabled="!isFormValid"
          @click="createToken"
        >
          创建代币
        </a-button>
      </a-form-item>
    </a-form>
  </div>
</template>

<style scoped>
.create-token-container {
  padding: 20px;
  background-color: #1f2940;
  border-radius: 4px;
}

.success-message {
  margin-top: 20px;
}

.token-mint-address {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.form-hint {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-top: 4px;
}
</style> 