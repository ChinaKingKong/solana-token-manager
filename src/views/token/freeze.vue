<script setup lang="ts">
import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import { PublicKey } from '@solana/web3.js';
import { getAccount, freezeAccount, thawAccount, getMint } from '@solana/spl-token';
import { getCurrentWallet, walletPublicKey, connected } from '../../utils/wallet';
import { connection } from '../../utils/wallet';

// 代币Mint地址
const tokenMintAddress = ref('');
const targetAccountAddress = ref('');

// 状态
const processing = ref(false);
const loadingInfo = ref(false);
const accountInfo = ref<any>(null);
const tokenInfo = ref<any>(null);
const isFrozen = ref(false);

// 操作类型
const operationType = ref<'freeze' | 'thaw'>('freeze');

// 验证函数
const isFormValid = computed(() => {
  return tokenMintAddress.value &&
         targetAccountAddress.value &&
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

  loadingInfo.value = true;
  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const mintInfo = await getMint(connection, mintPubkey);

    tokenInfo.value = {
      decimals: mintInfo.decimals,
      supply: mintInfo.supply.toString(),
      mintAuthority: mintInfo.mintAuthority?.toString() || 'None',
      freezeAuthority: mintInfo.freezeAuthority?.toString() || 'None'
    };

    // 检查是否有冻结权限
    if (!mintInfo.freezeAuthority) {
      message.warning('该代币没有设置冻结权限');
    } else if (walletPublicKey.value) {
      const isAuthority = mintInfo.freezeAuthority.toString() === walletPublicKey.value.toString();
      if (!isAuthority) {
        message.warning('您不是该代币的冻结权限持有者');
      }
    }
  } catch (error) {
    message.error('获取代币信息失败,请检查Mint地址');
    console.error(error);
  } finally {
    loadingInfo.value = false;
  }
};

// 获取账户信息
const fetchAccountInfo = async () => {
  if (!targetAccountAddress.value || !tokenMintAddress.value) {
    return;
  }

  loadingInfo.value = true;
  try {
    const accountPubkey = new PublicKey(targetAccountAddress.value);
    const accountData = await getAccount(connection, accountPubkey);

    accountInfo.value = {
      address: accountData.address.toString(),
      mint: accountData.mint.toString(),
      owner: accountData.owner.toString(),
      amount: accountData.amount.toString(),
      isFrozen: accountData.isFrozen
    };

    isFrozen.value = accountData.isFrozen;

    // 自动设置操作类型
    operationType.value = accountData.isFrozen ? 'thaw' : 'freeze';

    message.success('获取账户信息成功');
  } catch (error) {
    message.error('获取账户信息失败,请检查账户地址');
    console.error(error);
  } finally {
    loadingInfo.value = false;
  }
};

// 执行冻结或解冻操作
const handleOperation = async () => {
  if (!isFormValid.value) {
    message.error('请检查表单信息是否正确');
    return;
  }

  if (!connected.value) {
    message.error('请先连接钱包');
    return;
  }

  // 验证地址
  if (!isValidSolanaAddress(targetAccountAddress.value)) {
    message.error('目标账户地址格式不正确');
    return;
  }

  const wallet = getCurrentWallet();
  if (!wallet || !walletPublicKey.value) {
    message.error('请先连接钱包');
    return;
  }

  // 检查是否有冻结权限
  if (tokenInfo.value && !tokenInfo.value.freezeAuthority) {
    message.error('该代币没有设置冻结权限');
    return;
  }

  processing.value = true;

  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const targetAccountPubkey = new PublicKey(targetAccountAddress.value);

    if (operationType.value === 'freeze') {
      // 冻结账户
      await freezeAccount(
        connection,
        wallet,
        targetAccountPubkey,
        mintPubkey,
        wallet
      );

      message.success('成功冻结账户!');
      isFrozen.value = true;
      operationType.value = 'thaw';
    } else {
      // 解冻账户
      await thawAccount(
        connection,
        wallet,
        targetAccountPubkey,
        mintPubkey,
        wallet
      );

      message.success('成功解冻账户!');
      isFrozen.value = false;
      operationType.value = 'freeze';
    }

    // 刷新账户信息
    await fetchAccountInfo();
  } catch (error) {
    message.error(`${operationType.value === 'freeze' ? '冻结' : '解冻'}操作失败`);
    console.error(error);
  } finally {
    processing.value = false;
  }
};

// 监听地址变化
const onMintAddressChange = () => {
  if (tokenMintAddress.value) {
    fetchTokenInfo();
  }
};

const onAccountAddressChange = () => {
  if (targetAccountAddress.value && tokenMintAddress.value) {
    fetchAccountInfo();
  }
};

// 默认导出
defineOptions({
  name: 'FreezeManage'
});
</script>

<template>
  <div class="freeze-manage-container">
    <h2>冻结管理</h2>

    <div class="warning-section">
      <a-alert
        type="warning"
        show-icon
        message="警告"
        description="冻结和解冻操作需要代币的冻结权限(Freeze Authority)。只有冻结权限持有者才能执行这些操作。冻结后,该账户的代币将无法转账。"
      />
    </div>

    <a-form layout="vertical" class="freeze-form">
      <a-form-item label="代币Mint地址">
        <a-input
          v-model:value="tokenMintAddress"
          placeholder="请输入代币的Mint地址"
          @change="onMintAddressChange"
        />
        <div class="form-hint">输入要管理的代币的Mint地址</div>
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
          <a-descriptions-item label="冻结权限">
            {{ tokenInfo.freezeAuthority }}
          </a-descriptions-item>
        </a-descriptions>
      </div>

      <a-form-item label="目标账户地址 (ATA)">
        <a-input
          v-model:value="targetAccountAddress"
          placeholder="请输入要冻结/解冻的代币账户地址"
          @change="onAccountAddressChange"
        />
        <div class="form-hint">输入要管理的关联代币账户地址</div>
      </a-form-item>

      <!-- 账户信息显示 -->
      <div v-if="accountInfo" class="account-info-card">
        <h3>账户信息</h3>
        <a-descriptions bordered :column="1">
          <a-descriptions-item label="账户地址">
            <div class="address-text">
              {{ accountInfo.address.slice(0, 8) }}...{{ accountInfo.address.slice(-8) }}
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="代币Mint">
            <div class="address-text">
              {{ accountInfo.mint.slice(0, 8) }}...{{ accountInfo.mint.slice(-8) }}
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="所有者">
            <div class="address-text">
              {{ accountInfo.owner.slice(0, 8) }}...{{ accountInfo.owner.slice(-8) }}
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="余额">
            {{ (Number(accountInfo.amount) / Math.pow(10, tokenInfo?.decimals || 9)).toFixed(tokenInfo?.decimals || 9) }}
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="isFrozen ? 'error' : 'success'">
              {{ isFrozen ? '已冻结' : '正常' }}
            </a-tag>
          </a-descriptions-item>
        </a-descriptions>
      </div>

      <!-- 操作类型选择 -->
      <div v-if="accountInfo" class="operation-type-card">
        <h3>选择操作</h3>
        <a-radio-group v-model:value="operationType" button-style="solid">
          <a-radio-button value="freeze" :disabled="isFrozen">
            <template #icon>
              <LockOutlined />
            </template>
            冻结账户
          </a-radio-button>
          <a-radio-button value="thaw" :disabled="!isFrozen">
            <template #icon>
              <UnlockOutlined />
            </template>
            解冻账户
          </a-radio-button>
        </a-radio-group>

        <div class="operation-description">
          <div v-if="operationType === 'freeze'" class="freeze-desc">
            <p>
              <WarningOutlined style="color: #faad14; margin-right: 8px;" />
              <strong>冻结操作</strong>
            </p>
            <p>冻结后,该账户的代币将无法转账或交易。</p>
          </div>
          <div v-else class="thaw-desc">
            <p>
              <CheckCircleOutlined style="color: #52c41a; margin-right: 8px;" />
              <strong>解冻操作</strong>
            </p>
            <p>解冻后,该账户将恢复正常交易功能。</p>
          </div>
        </div>
      </div>

      <a-form-item v-if="accountInfo">
        <a-space>
          <a-button
            :type="operationType === 'freeze' ? 'primary' : 'default'"
            danger
            :loading="processing"
            :disabled="!isFormValid"
            @click="handleOperation"
          >
            <template #icon>
              <LockOutlined v-if="operationType === 'freeze'" />
              <UnlockOutlined v-else />
            </template>
            {{ operationType === 'freeze' ? '冻结账户' : '解冻账户' }}
          </a-button>
          <a-button @click="fetchAccountInfo" :disabled="!targetAccountAddress">
            刷新信息
          </a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <!-- 操作说明 -->
    <div class="instructions">
      <h3>操作步骤</h3>
      <ol>
        <li>输入代币的Mint地址</li>
        <li>检查代币信息,确保您是冻结权限持有者</li>
        <li>输入要管理的关联代币账户地址</li>
        <li>查看账户当前状态(已冻结或正常)</li>
        <li>选择要执行的操作(冻结或解冻)</li>
        <li>点击按钮执行操作</li>
      </ol>
    </div>

    <!-- 注意事项 -->
    <div class="notes">
      <h3>注意事项</h3>
      <ul>
        <li>只有代币的冻结权限持有者才能执行冻结/解冻操作</li>
        <li>冻结账户会阻止该账户的代币被转账或交易</li>
        <li>解冻账户会恢复正常的交易功能</li>
        <li>冻结/解冻操作需要支付交易费用(gas fee)</li>
        <li>请确保您有权操作目标账户,否则操作将失败</li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { LockOutlined, UnlockOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons-vue';

export default {
  components: {
    LockOutlined,
    UnlockOutlined,
    WarningOutlined,
    CheckCircleOutlined
  }
};
</script>

<style scoped>
.freeze-manage-container {
  padding: 20px;
  background: #fff;
  border-radius: 4px;
}

.warning-section {
  margin-bottom: 20px;
}

.freeze-form {
  margin-top: 20px;
}

.form-hint {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-top: 4px;
}

.token-info-card,
.account-info-card {
  margin: 20px 0;
  padding: 15px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.token-info-card h3,
.account-info-card h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 500;
}

.address-text {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.operation-type-card {
  margin: 20px 0;
  padding: 15px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.operation-type-card h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 500;
}

.operation-description {
  margin-top: 15px;
  padding: 10px;
  border-radius: 4px;
}

.freeze-desc {
  background-color: rgba(250, 173, 20, 0.1);
}

.thaw-desc {
  background-color: rgba(82, 196, 26, 0.1);
}

.operation-description p {
  margin: 5px 0;
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

.notes {
  margin-top: 20px;
  padding: 20px;
  background-color: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.notes h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 500;
}

.notes ul {
  padding-left: 20px;
  margin: 0;
}

.notes li {
  margin-bottom: 8px;
  line-height: 1.6;
}
</style>
