<script setup lang="ts">
import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import { PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, getAccount } from '@solana/spl-token';
import { getCurrentWallet, walletPublicKey, connected } from '../../utils/wallet';
import { connection } from '../../utils/wallet';
import { getMint } from '@solana/spl-token';

// 代币Mint地址
const tokenMintAddress = ref('');
const ownerAddress = ref('');

// 状态
const creating = ref(false);
const loadingInfo = ref(false);
const tokenInfo = ref<any>(null);
const createdAccount = ref('');
const accountExists = ref(false);
const existingAccountInfo = ref<any>(null);

// 验证函数
const isFormValid = computed(() => {
  return tokenMintAddress.value &&
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

    message.success('获取代币信息成功');
  } catch (error) {
    message.error('获取代币信息失败,请检查Mint地址');
    console.error(error);
  } finally {
    loadingInfo.value = false;
  }
};

// 检查账户是否已存在
const checkAccountExists = async () => {
  if (!tokenMintAddress.value || !walletPublicKey.value) {
    return;
  }

  const owner = ownerAddress.value || walletPublicKey.value.toString();

  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const ownerPubkey = new PublicKey(owner);

    // 尝试获取关联代币账户
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      getCurrentWallet()!,
      mintPubkey,
      ownerPubkey
    );

    createdAccount.value = tokenAccount.address.toString();

    // 检查账户余额以确定是新创建还是已存在
    const accountInfo = await getAccount(connection, tokenAccount.address);
    const balance = Number(accountInfo.amount);

    if (balance > 0 || accountInfo.isFrozen) {
      accountExists.value = true;
      existingAccountInfo.value = {
        address: tokenAccount.address.toString(),
        balance: balance.toString(),
        isFrozen: accountInfo.isFrozen,
        owner: accountInfo.owner.toString()
      };
      message.info('该账户已存在');
    } else {
      accountExists.value = false;
      existingAccountInfo.value = null;
      message.success('这是新创建的账户');
    }

    return tokenAccount.address.toString();
  } catch (error) {
    message.error('检查账户失败');
    console.error(error);
    return null;
  }
};

// 创建关联代币账户
const handleCreateAccount = async () => {
  if (!isFormValid.value) {
    message.error('请检查表单信息是否正确');
    return;
  }

  if (!connected.value) {
    message.error('请先连接钱包');
    return;
  }

  // 验证Mint地址
  if (!isValidSolanaAddress(tokenMintAddress.value)) {
    message.error('代币Mint地址格式不正确');
    return;
  }

  // 如果提供了owner地址,验证格式
  if (ownerAddress.value && !isValidSolanaAddress(ownerAddress.value)) {
    message.error('所有者地址格式不正确');
    return;
  }

  const wallet = getCurrentWallet();
  if (!wallet || !walletPublicKey.value) {
    message.error('请先连接钱包');
    return;
  }

  creating.value = true;

  try {
    const mintPubkey = new PublicKey(tokenMintAddress.value);
    const ownerPubkey = ownerAddress.value
      ? new PublicKey(ownerAddress.value)
      : walletPublicKey.value;

    // 创建或获取关联代币账户
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      mintPubkey,
      ownerPubkey
    );

    createdAccount.value = tokenAccount.address.toString();

    // 获取账户信息
    const accountInfo = await getAccount(connection, tokenAccount.address);
    existingAccountInfo.value = {
      address: tokenAccount.address.toString(),
      balance: Number(accountInfo.amount).toString(),
      isFrozen: accountInfo.isFrozen,
      owner: accountInfo.owner.toString()
    };

    const isNew = Number(accountInfo.amount) === 0 && !accountInfo.isFrozen;
    accountExists.value = !isNew;

    message.success(isNew ? '成功创建关联代币账户!' : '账户已存在');

  } catch (error) {
    message.error('创建账户失败');
    console.error(error);
  } finally {
    creating.value = false;
  }
};

// 复制地址到剪贴板
const copyAddress = () => {
  if (createdAccount.value) {
    navigator.clipboard.writeText(createdAccount.value)
      .then(() => {
        message.success('已复制到剪贴板');
      })
      .catch(() => {
        message.error('复制失败');
      });
  }
};

// 设置为当前钱包地址
const setAsWalletAddress = () => {
  if (walletPublicKey.value) {
    ownerAddress.value = walletPublicKey.value.toString();
  }
};

// 监听Mint地址变化
const onMintAddressChange = () => {
  if (tokenMintAddress.value) {
    fetchTokenInfo();
    createdAccount.value = '';
    accountExists.value = false;
    existingAccountInfo.value = null;
  }
};

// 默认导出
defineOptions({
  name: 'CreateAssociatedAccount'
});
</script>

<template>
  <div class="create-account-container">
    <h2>创建关联代币账户</h2>

    <div class="info-section">
      <a-alert
        type="info"
        show-icon
        message="关联代币账户说明"
        description="关联代币账户(Associated Token Account, ATA)是Solana SPL Token程序使用的标准账户。每个钱包地址对每个代币都有一个唯一的ATA。如果您要接收某个代币,必须先创建该代币的ATA。"
      />
    </div>

    <a-form layout="vertical" class="create-form">
      <a-form-item label="代币Mint地址">
        <a-input
          v-model:value="tokenMintAddress"
          placeholder="请输入代币的Mint地址"
          @change="onMintAddressChange"
        />
        <div class="form-hint">输入要创建ATA的代币的Mint地址</div>
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

      <a-form-item label="所有者地址 (可选)">
        <a-input
          v-model:value="ownerAddress"
          placeholder="留空则使用当前连接的钱包地址"
        >
          <template #suffix>
            <a-button
              type="link"
              size="small"
              @click="setAsWalletAddress"
              v-if="walletPublicKey && !ownerAddress"
            >
              使用当前钱包
            </a-button>
          </template>
        </a-input>
        <div class="form-hint">
          如果留空,将为当前连接的钱包创建ATA。您也可以为其他地址创建ATA。
        </div>
      </a-form-item>

      <a-form-item>
        <a-space>
          <a-button
            type="primary"
            :loading="creating"
            :disabled="!isFormValid"
            @click="handleCreateAccount"
          >
            <template #icon>
              <PlusOutlined />
            </template>
            创建/获取账户
          </a-button>
          <a-button @click="fetchTokenInfo" :disabled="!tokenMintAddress">
            刷新代币信息
          </a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <!-- 创建结果 -->
    <div v-if="createdAccount" class="result-section">
      <a-alert
        :type="accountExists ? 'info' : 'success'"
        show-icon
        :message="accountExists ? '账户已存在' : '账户创建成功'"
      >
        <template #description>
          {{ accountExists ? '该代币账户已经存在,已返回现有账户信息' : '成功创建新的关联代币账户' }}
        </template>
      </a-alert>

      <div class="account-details">
        <h3>账户详情</h3>
        <a-descriptions bordered :column="1">
          <a-descriptions-item label="ATA地址">
            <div class="address-row">
              <code class="address-text">{{ createdAccount }}</code>
              <a-button type="link" size="small" @click="copyAddress">
                <template #icon>
                  <CopyOutlined />
                </template>
                复制
              </a-button>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="所有者" v-if="existingAccountInfo">
            <code class="address-text">{{ existingAccountInfo.owner }}</code>
          </a-descriptions-item>
          <a-descriptions-item label="余额" v-if="existingAccountInfo">
            {{
              tokenInfo
                ? (Number(existingAccountInfo.balance) / Math.pow(10, tokenInfo.decimals)).toFixed(tokenInfo.decimals)
                : existingAccountInfo.balance
            }}
          </a-descriptions-item>
          <a-descriptions-item label="状态" v-if="existingAccountInfo">
            <a-tag :color="existingAccountInfo.isFrozen ? 'error' : 'success'">
              {{ existingAccountInfo.isFrozen ? '已冻结' : '正常' }}
            </a-tag>
          </a-descriptions-item>
        </a-descriptions>
      </div>
    </div>

    <!-- 操作说明 -->
    <div class="instructions">
      <h3>操作说明</h3>
      <ol>
        <li>输入要创建ATA的代币的Mint地址</li>
        <li>(可选)输入所有者地址。如果留空,将使用当前连接的钱包地址</li>
        <li>点击"创建/获取账户"按钮</li>
        <li>如果账户已存在,系统会返回现有账户信息</li>
        <li>如果账户不存在,系统会创建新的ATA</li>
        <li>复制ATA地址以供后续使用</li>
      </ol>
    </div>

    <!-- 注意事项 -->
    <div class="notes">
      <h3>注意事项</h3>
      <ul>
        <li>每个钱包地址对每个代币只能有一个ATA</li>
        <li>如果ATA已存在,系统会返回现有地址而不是创建新账户</li>
        <li>创建ATA需要支付少量SOL作为租金(约0.002 SOL)</li>
        <li>为其他地址创建ATA需要支付租金,但账户所有权属于目标地址</li>
        <li>首次创建ATA时账户余额为0,需要接收或铸造代币后才有余额</li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { PlusOutlined, CopyOutlined } from '@ant-design/icons-vue';

export default {
  components: {
    PlusOutlined,
    CopyOutlined
  }
};
</script>

<style scoped>
.create-account-container {
  padding: 20px;
  background: #fff;
  border-radius: 4px;
}

.info-section {
  margin-bottom: 20px;
}

.create-form {
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

.result-section {
  margin-top: 30px;
}

.account-details {
  margin-top: 20px;
  padding: 15px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.account-details h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 500;
}

.address-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.address-text {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  flex: 1;
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
