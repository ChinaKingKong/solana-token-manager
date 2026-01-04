<script setup lang="ts">
import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import { PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, getAccount, burn } from '@solana/spl-token';
import { getCurrentWallet, walletPublicKey, connected } from '../../utils/wallet';
import { connection } from '../../utils/wallet';
import { getMint } from '@solana/spl-token';

// 代币Mint地址
const tokenMintAddress = ref('');
const burnAmount = ref('');

// 状态
const burning = ref(false);
const loadingBalance = ref(false);
const decimals = ref(9);
const currentBalance = ref(0);
const tokenInfo = ref<any>(null);
const ownerATA = ref('');

// 验证函数
const isFormValid = computed(() => {
  return tokenMintAddress.value &&
         burnAmount.value &&
         parseFloat(burnAmount.value) > 0 &&
         parseFloat(burnAmount.value) <= currentBalance.value &&
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
    await fetchCurrentBalance();
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

    ownerATA.value = tokenAccount.address.toString();

    // 获取账户余额
    const accountInfo = await getAccount(connection, tokenAccount.address);
    currentBalance.value = Number(accountInfo.amount) / Math.pow(10, decimals.value);
  } catch (error) {
    message.error('获取余额失败');
    console.error(error);
  } finally {
    loadingBalance.value = false;
  }
};

// 销毁代币
const handleBurn = async () => {
  if (!isFormValid.value) {
    message.error('请检查表单信息是否正确');
    return;
  }

  if (!connected.value) {
    message.error('请先连接钱包');
    return;
  }

  // 二次确认
  Modal.confirm({
    title: '确认销毁代币',
    content: `您确定要销毁 ${burnAmount.value} 个代币吗?此操作不可逆!`,
    okText: '确认销毁',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await executeBurn();
    }
  });
};

// 执行销毁操作
const executeBurn = async () => {
  const wallet = getCurrentWallet();
  if (!wallet || !walletPublicKey.value) {
    message.error('请先连接钱包');
    return;
  }

  burning.value = true;

  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const ownerPubkey = walletPublicKey.value;

    // 获取关联代币账户
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      mintPubkey,
      ownerPubkey
    );

    // 计算销毁数量(考虑小数位)
    const amountToBurn = Math.floor(parseFloat(burnAmount.value) * Math.pow(10, decimals.value));

    // 销毁代币
    await burn(
      connection,
      wallet,
      tokenAccount.address,
      mintPubkey,
      wallet,
      amountToBurn
    );

    message.success(`成功销毁 ${burnAmount.value} 代币!`);

    // 刷新余额
    await fetchCurrentBalance();

    // 清空表单
    burnAmount.value = '';
  } catch (error) {
    message.error('销毁代币失败');
    console.error(error);
  } finally {
    burning.value = false;
  }
};

// 设置最大销毁金额
const setMaxAmount = () => {
  burnAmount.value = currentBalance.value.toString();
};

// 监听Mint地址变化
const onMintAddressChange = () => {
  if (tokenMintAddress.value) {
    fetchTokenInfo();
  }
};

// 默认导出
defineOptions({
  name: 'BurnToken'
});
</script>

<template>
  <div class="burn-token-container">
    <h2>销毁代币</h2>

    <div class="warning-section">
      <a-alert
        type="warning"
        show-icon
        message="警告"
        description="销毁代币是不可逆的操作!一旦销毁,代币将永久从流通中移除,无法恢复。请谨慎操作并确认销毁数量。"
      />
    </div>

    <div class="info-section">
      <a-alert
        type="info"
        show-icon
        message="销毁说明"
        description="销毁代币会从您的关联代币账户(ATA)中永久移除指定数量的代币。这将减少代币的总供应量。"
      />
    </div>

    <a-form layout="vertical" class="burn-form">
      <a-form-item label="代币Mint地址">
        <a-input
          v-model:value="tokenMintAddress"
          placeholder="请输入代币的Mint地址"
          @change="onMintAddressChange"
        />
        <div class="form-hint">输入要销毁的代币的Mint地址</div>
      </a-form-item>

      <!-- 代币信息显示 -->
      <div v-if="tokenInfo" class="token-info-card">
        <h3>代币信息</h3>
        <a-descriptions bordered :column="1">
          <a-descriptions-item label="小数位数">
            {{ tokenInfo.decimals }}
          </a-descriptions-item>
          <a-descriptions-item label="当前总供应量">
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
            <span>您的余额</span>
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
          <div class="ata-address" v-if="ownerATA">
            <small>ATA: {{ ownerATA.slice(0, 8) }}...{{ ownerATA.slice(-8) }}</small>
          </div>
        </a-card>
      </div>

      <a-form-item label="销毁数量">
        <a-input
          v-model:value="burnAmount"
          type="number"
          :min="0"
          :max="currentBalance"
          :step="Math.pow(10, -decimals)"
          placeholder="请输入要销毁的数量"
        >
          <template #suffix>
            <a-button
              type="link"
              size="small"
              @click="setMaxAmount"
              :disabled="!ownerATA"
            >
              MAX
            </a-button>
          </template>
        </a-input>
        <div class="form-hint">
          最多支持 {{ decimals }} 位小数,当前余额: {{ currentBalance.toFixed(decimals) }}
        </div>
      </a-form-item>

      <a-form-item>
        <a-space>
          <a-button
            type="primary"
            danger
            :loading="burning"
            :disabled="!isFormValid"
            @click="handleBurn"
          >
            <template #icon>
              <FireOutlined />
            </template>
            销毁代币
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
        <li>输入要销毁的代币的Mint地址</li>
        <li>查看代币信息和您的当前余额</li>
        <li>输入要销毁的数量(可点击MAX销毁全部)</li>
        <li>点击"销毁代币"按钮</li>
        <li>在确认对话框中确认销毁操作</li>
      </ol>
    </div>

    <!-- 注意事项 -->
    <div class="notes">
      <h3>注意事项</h3>
      <ul>
        <li>销毁代币将永久减少代币的总供应量</li>
        <li>销毁操作需要支付交易费用(gas fee)</li>
        <li>销毁后的代币无法恢复,请谨慎操作</li>
        <li>确保您的钱包中有足够的SOL支付交易费用</li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { FireOutlined } from '@ant-design/icons-vue';
import { Modal } from 'ant-design-vue';

export default {
  components: {
    FireOutlined
  },
  setup() {
    return {
      Modal
    };
  }
};
</script>

<style scoped>
.burn-token-container {
  padding: 20px;
  background: #fff;
  border-radius: 4px;
}

.warning-section {
  margin-bottom: 20px;
}

.info-section {
  margin-bottom: 20px;
}

.burn-form {
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

.notes {
  margin-top: 20px;
  padding: 20px;
  background-color: rgba(255, 77, 79, 0.05);
  border: 1px solid rgba(255, 77, 79, 0.2);
  border-radius: 4px;
}

.notes h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 500;
  color: #ff4d4f;
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
