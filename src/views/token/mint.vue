<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import { getCurrentWallet, walletPublicKey, connected } from '../../utils/wallet';
import { connection } from '../../utils/wallet';
import { getMint } from '@solana/spl-token';

// 代币Mint地址
const tokenMintAddress = ref('');
const decimals = ref(9);
const mintAmount = ref('');

// 状态
const minting = ref(false);
const loadingBalance = ref(false);
const currentBalance = ref(0);
const tokenInfo = ref<any>(null);

// 验证函数
const isFormValid = computed(() => {
  return tokenMintAddress.value &&
         mintAmount.value &&
         parseFloat(mintAmount.value) > 0 &&
         walletPublicKey.value !== null;
});

// 获取代币信息
const fetchTokenInfo = async () => {
  if (!tokenMintAddress.value) {
    return;
  }

  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const mintInfo = await getMint(connection, mintPubkey);

    tokenInfo.value = {
      decimals: mintInfo.decimals,
      supply: mintInfo.supply.toString(),
      mintAuthority: mintInfo.mintAuthority?.toString() || 'None',
      freezeAuthority: mintInfo.freezeAuthority?.toString() || 'None'
    };

    decimals.value = mintInfo.decimals;
    message.success('获取代币信息成功');
  } catch (error) {
    message.error('获取代币信息失败,请检查Mint地址');
    console.error(error);
  }
};

// 获取当前余额
const fetchCurrentBalance = async () => {
  if (!tokenMintAddress.value || !walletPublicKey.value) {
    return;
  }

  loadingBalance.value = true;
  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const ownerPubkey = walletPublicKey.value;

    // 获取或创建关联代币账户
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      getCurrentWallet()!,
      mintPubkey,
      ownerPubkey
    );

    currentBalance.value = Number(tokenAccount.amount) / Math.pow(10, decimals.value);
  } catch (error) {
    message.error('获取余额失败');
    console.error(error);
  } finally {
    loadingBalance.value = false;
  }
};

// 铸造代币
const handleMint = async () => {
  if (!isFormValid.value) {
    message.error('请检查表单信息是否正确');
    return;
  }

  if (!connected.value) {
    message.error('请先连接钱包');
    return;
  }

  const wallet = getCurrentWallet();
  if (!wallet || !walletPublicKey.value) {
    message.error('请先连接钱包');
    return;
  }

  minting.value = true;

  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const ownerPubkey = walletPublicKey.value;

    // 获取或创建关联代币账户
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      mintPubkey,
      ownerPubkey
    );

    // 计算铸造数量(考虑小数位)
    const amountToMint = Math.floor(parseFloat(mintAmount.value) * Math.pow(10, decimals.value));

    // 铸造代币
    await mintTo(
      connection,
      wallet,
      mintPubkey,
      tokenAccount.address,
      wallet,
      amountToMint
    );

    message.success(`成功铸造 ${mintAmount.value} 代币!`);

    // 刷新余额
    await fetchCurrentBalance();

    // 清空表单
    mintAmount.value = '';
  } catch (error) {
    message.error('铸造代币失败');
    console.error(error);
  } finally {
    minting.value = false;
  }
};

// 监听Mint地址变化
const onMintAddressChange = () => {
  if (tokenMintAddress.value) {
    fetchTokenInfo();
    fetchCurrentBalance();
  }
};

// 默认导出
defineOptions({
  name: 'MintToken'
});
</script>

<template>
  <div class="mint-token-container">
    <h2>铸造代币</h2>

    <div class="info-section">
      <a-alert
        type="info"
        show-icon
        message="铸造说明"
        description="在铸造代币之前，请确保您是代币的铸币权限持有者(Mint Authority)。只有拥有铸币权限的地址才能铸造新的代币。"
      />
    </div>

    <a-form layout="vertical" class="mint-form">
      <a-form-item label="代币Mint地址">
        <a-input
          v-model:value="tokenMintAddress"
          placeholder="请输入代币的Mint地址"
          @change="onMintAddressChange"
        />
        <div class="form-hint">输入要铸造的代币的Mint地址</div>
      </a-form-item>

      <!-- 代币信息显示 -->
      <div v-if="tokenInfo" class="token-info-card">
        <h3>代币信息</h3>
        <a-descriptions bordered :column="1">
          <a-descriptions-item label="小数位数">
            {{ tokenInfo.decimals }}
          </a-descriptions-item>
          <a-descriptions-item label="当前供应量">
            {{ (Number(tokenInfo.supply) / Math.pow(10, tokenInfo.decimals)).toFixed(tokenInfo.decimals) }}
          </a-descriptions-item>
          <a-descriptions-item label="铸币权限">
            {{ tokenInfo.mintAuthority }}
          </a-descriptions-item>
          <a-descriptions-item label="冻结权限">
            {{ tokenInfo.freezeAuthority }}
          </a-descriptions-item>
        </a-descriptions>
      </div>

      <!-- 当前余额 -->
      <div v-if="tokenInfo" class="balance-card">
        <a-card>
          <template #title>
            <span>当前余额</span>
          </template>
          <template #extra>
            <a-button
              type="link"
              :loading="loadingBalance"
              @click="fetchCurrentBalance"
            >
              刷新
            </a-button>
          </template>
          <div class="balance-amount">
            {{ currentBalance.toFixed(decimals) }}
          </div>
        </a-card>
      </div>

      <a-form-item label="铸造数量">
        <a-input-number
          v-model:value="mintAmount"
          :min="0"
          :precision="decimals"
          :step="Math.pow(10, -decimals)"
          style="width: 100%"
          placeholder="请输入要铸造的数量"
        />
        <div class="form-hint">最多支持 {{ decimals }} 位小数</div>
      </a-form-item>

      <a-form-item>
        <a-space>
          <a-button
            type="primary"
            :loading="minting"
            :disabled="!isFormValid"
            @click="handleMint"
          >
            <template #icon>
              <PlusOutlined />
            </template>
            铸造代币
          </a-button>
          <a-button @click="fetchCurrentBalance" :disabled="!tokenMintAddress">
            刷新余额
          </a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <!-- 操作说明 -->
    <div class="instructions">
      <h3>操作步骤</h3>
      <ol>
        <li>输入代币的Mint地址(创建代币时会生成)</li>
        <li>系统会自动加载代币信息(小数位数、供应量等)</li>
        <li>查看当前余额和代币信息</li>
        <li>输入要铸造的数量</li>
        <li>点击"铸造代币"按钮完成铸造</li>
      </ol>
    </div>
  </div>
</template>

<script lang="ts">
import { PlusOutlined } from '@ant-design/icons-vue';
export default {
  components: {
    PlusOutlined
  }
};
</script>

<style scoped>
.mint-token-container {
  padding: 20px;
  background: #fff;
  border-radius: 4px;
}

.info-section {
  margin-bottom: 20px;
}

.mint-form {
  margin-top: 20px;
}

.form-hint {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-top: 4px;
}

.token-info-card {
  margin: 20px 0;
  padding: 15px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.token-info-card h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 500;
}

.balance-card {
  margin: 20px 0;
}

.balance-amount {
  font-size: 24px;
  font-weight: bold;
  color: #1890ff;
  text-align: center;
  padding: 10px 0;
}

.instructions {
  margin-top: 30px;
  padding: 20px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.instructions h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 500;
}

.instructions ol {
  padding-left: 20px;
  margin: 0;
}

.instructions li {
  margin-bottom: 8px;
  line-height: 1.6;
}
</style>
