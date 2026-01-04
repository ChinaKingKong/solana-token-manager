<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, getAccount, transfer } from '@solana/spl-token';
import { getCurrentWallet, walletPublicKey, connected, walletBalance } from '../../utils/wallet';
import { connection } from '../../utils/wallet';
import { getMint } from '@solana/spl-token';

// 代币Mint地址
const tokenMintAddress = ref('');
const recipientAddress = ref('');
const transferAmount = ref('');

// 状态
const transferring = ref(false);
const loadingBalance = ref(false);
const decimals = ref(9);
const senderBalance = ref(0);
const tokenInfo = ref<any>(null);
const senderATA = ref('');

// 验证函数
const isFormValid = computed(() => {
  return tokenMintAddress.value &&
         recipientAddress.value &&
         transferAmount.value &&
         parseFloat(transferAmount.value) > 0 &&
         walletPublicKey.value !== null;
});

// 验证Solana地址
const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};

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
    await fetchSenderBalance();
  } catch (error) {
    message.error('获取代币信息失败,请检查Mint地址');
    console.error(error);
  }
};

// 获取发送者余额
const fetchSenderBalance = async () => {
  if (!tokenMintAddress.value || !walletPublicKey.value) {
    return;
  }

  loadingBalance.value = true;
  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const ownerPubkey = walletPublicKey.value;

    // 获取关联代币账户
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      getCurrentWallet()!,
      mintPubkey,
      ownerPubkey
    );

    senderATA.value = tokenAccount.address.toString();

    // 获取账户余额
    const accountInfo = await getAccount(connection, tokenAccount.address);
    senderBalance.value = Number(accountInfo.amount) / Math.pow(10, decimals.value);
  } catch (error) {
    message.error('获取余额失败');
    console.error(error);
  } finally {
    loadingBalance.value = false;
  }
};

// 转账代币
const handleTransfer = async () => {
  if (!isFormValid.value) {
    message.error('请检查表单信息是否正确');
    return;
  }

  if (!connected.value) {
    message.error('请先连接钱包');
    return;
  }

  // 验证接收地址
  if (!isValidSolanaAddress(recipientAddress.value)) {
    message.error('接收地址格式不正确');
    return;
  }

  // 检查余额
  if (parseFloat(transferAmount.value) > senderBalance.value) {
    message.error('转账金额不能超过当前余额');
    return;
  }

  const wallet = getCurrentWallet();
  if (!wallet || !walletPublicKey.value) {
    message.error('请先连接钱包');
    return;
  }

  transferring.value = true;

  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const recipientPubkey = new PublicKey(recipientAddress.value);
    const ownerPubkey = walletPublicKey.value;

    // 获取发送者的关联代币账户
    const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      mintPubkey,
      ownerPubkey
    );

    // 获取或创建接收者的关联代币账户
    const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      mintPubkey,
      recipientPubkey
    );

    // 计算转账数量(考虑小数位)
    const amountToTransfer = Math.floor(parseFloat(transferAmount.value) * Math.pow(10, decimals.value));

    // 执行转账
    await transfer(
      connection,
      wallet,
      senderTokenAccount.address,
      recipientTokenAccount.address,
      ownerPubkey,
      amountToTransfer
    );

    message.success(`成功转账 ${transferAmount.value} 代币到 ${recipientAddress.value.slice(0, 8)}...`);

    // 刷新余额
    await fetchSenderBalance();

    // 清空表单
    transferAmount.value = '';
    recipientAddress.value = '';
  } catch (error) {
    message.error('转账失败');
    console.error(error);
  } finally {
    transferring.value = false;
  }
};

// 设置最大转账金额
const setMaxAmount = () => {
  transferAmount.value = senderBalance.value.toString();
};

// 监听Mint地址变化
const onMintAddressChange = () => {
  if (tokenMintAddress.value) {
    fetchTokenInfo();
  }
};

// 默认导出
defineOptions({
  name: 'TransferToken'
});
</script>

<template>
  <div class="transfer-token-container">
    <h2>转账代币</h2>

    <div class="info-section">
      <a-alert
        type="info"
        show-icon
        message="转账说明"
        description="转账前请确保接收地址正确,转账到错误地址可能导致资金无法找回。建议先转账小额测试。"
      />
    </div>

    <!-- SOL余额卡片 -->
    <a-card class="sol-balance-card" title="SOL余额">
      <div class="balance-info">
        <div class="balance-label">当前余额:</div>
        <div class="balance-value">{{ walletBalance }} SOL</div>
      </div>
    </a-card>

    <a-form layout="vertical" class="transfer-form">
      <a-form-item label="代币Mint地址">
        <a-input
          v-model:value="tokenMintAddress"
          placeholder="请输入代币的Mint地址"
          @change="onMintAddressChange"
        />
        <div class="form-hint">输入要转账的代币的Mint地址</div>
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
        </a-descriptions>
      </div>

      <!-- 发送者余额 -->
      <div v-if="tokenInfo" class="balance-card">
        <a-card>
          <template #title>
            <span>您的余额</span>
          </template>
          <template #extra>
            <a-button
              type="link"
              :loading="loadingBalance"
              @click="fetchSenderBalance"
            >
              刷新
            </a-button>
          </template>
          <div class="balance-amount">
            {{ senderBalance.toFixed(decimals) }}
          </div>
          <div class="ata-address" v-if="senderATA">
            <small>ATA: {{ senderATA.slice(0, 8) }}...{{ senderATA.slice(-8) }}</small>
          </div>
        </a-card>
      </div>

      <a-form-item label="接收地址">
        <a-input
          v-model:value="recipientAddress"
          placeholder="请输入接收者的钱包地址"
        />
        <div class="form-hint">接收代币的钱包地址(Solana地址)</div>
      </a-form-item>

      <a-form-item label="转账数量">
        <a-input
          v-model:value="transferAmount"
          type="number"
          :min="0"
          :step="Math.pow(10, -decimals)"
          placeholder="请输入转账数量"
        >
          <template #suffix>
            <a-button
              type="link"
              size="small"
              @click="setMaxAmount"
              :disabled="!senderATA"
            >
              MAX
            </a-button>
          </template>
        </a-input>
        <div class="form-hint">最多支持 {{ decimals }} 位小数,当前余额: {{ senderBalance.toFixed(decimals) }}</div>
      </a-form-item>

      <a-form-item>
        <a-space>
          <a-button
            type="primary"
            :loading="transferring"
            :disabled="!isFormValid"
            @click="handleTransfer"
          >
            <template #icon>
              <SendOutlined />
            </template>
            转账
          </a-button>
          <a-button @click="fetchSenderBalance" :disabled="!tokenMintAddress">
            刷新余额
          </a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <!-- 操作说明 -->
    <div class="instructions">
      <h3>操作步骤</h3>
      <ol>
        <li>输入要转账的代币的Mint地址</li>
        <li>查看您的当前余额</li>
        <li>输入接收者的钱包地址</li>
        <li>输入转账数量(可点击MAX使用全部余额)</li>
        <li>点击"转账"按钮完成转账</li>
      </ol>
    </div>

    <!-- 费用说明 -->
    <div class="fee-info">
      <a-alert
        type="warning"
        show-icon
        message="费用说明"
        description="转账需要支付交易费用(gas fee),费用约为0.000005 SOL,请确保钱包中有足够的SOL余额。"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { SendOutlined } from '@ant-design/icons-vue';
export default {
  components: {
    SendOutlined
  }
};
</script>

<style scoped>
.transfer-token-container {
  padding: 20px;
  background: #fff;
  border-radius: 4px;
}

.info-section {
  margin-bottom: 20px;
}

.sol-balance-card {
  margin-bottom: 20px;
}

.balance-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.balance-label {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.65);
}

.balance-value {
  font-size: 20px;
  font-weight: bold;
  color: #1890ff;
}

.transfer-form {
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

.ata-address {
  margin-top: 10px;
  text-align: center;
  color: rgba(0, 0, 0, 0.45);
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

.fee-info {
  margin-top: 20px;
}
</style>
