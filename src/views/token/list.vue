<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '../../composables/useWallet';

// 代币数据接口
interface TokenData {
  mint: string;
  ata: string;
  balance: number;
  decimals: number;
  symbol?: string;
  name?: string;
  logoURI?: string;
  price?: number;
  value?: number;
  change24h?: number;
}

// 使用钱包Hook
const {
  walletState,
  connection,
  fetchBalance,
} = useWallet();

// 代币列表
const tokens = ref<TokenData[]>([]);
const loading = ref(false);

// 刷新余额
const refreshBalance = async () => {
  if (!walletState.value.connected) {
    message.error('请先连接钱包');
    return;
  }

  try {
    await fetchBalance();
    await fetchTokenList();
    message.success('余额已更新');
  } catch (error) {
    message.error('获取余额失败');
    console.error(error);
  }
};

// 获取代币列表
const fetchTokenList = async () => {
  if (!walletState.value.publicKey) {
    return;
  }

  loading.value = true;

  try {
    // 获取钱包的所有代币账户
    const tokenAccounts = await connection.value.getParsedTokenAccountsByOwner(
      walletState.value.publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    const tokenList: TokenData[] = [];

    for (const account of tokenAccounts.value) {
      const parsedData = account.account.data.parsed;
      const tokenAmount = parsedData.info.tokenAmount;

      // 只显示余额大于0的代币
      if (tokenAmount.amount !== '0') {
        tokenList.push({
          mint: parsedData.info.mint,
          ata: account.pubkey.toString(),
          balance: parseFloat(tokenAmount.uiAmount || '0'),
          decimals: tokenAmount.decimals,
        });
      }
    }

    tokens.value = tokenList;

    // 获取代币元数据
    await fetchTokenMetadata();

  } catch (error) {
    message.error('获取代币列表失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

// 获取代币元数据
const fetchTokenMetadata = async () => {
  try {
    const response = await fetch('https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json');
    const tokenList = await response.json();

    tokens.value = tokens.value.map(token => {
      const metadata = tokenList.tokens.find((t: any) => t.address === token.mint);
      if (metadata) {
        return {
          ...token,
          symbol: metadata.symbol,
          name: metadata.name,
          logoURI: metadata.logoURI,
        };
      }
      return token;
    });
  } catch (error) {
    console.error('获取代币元数据失败:', error);
  }
};

// 计算总价值
const totalValue = computed(() => {
  return tokens.value.reduce((sum, token) => {
    return sum + (token.value || 0);
  }, 0);
});

// 格式化地址
const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
};

// 复制地址
const copyAddress = (address: string) => {
  navigator.clipboard.writeText(address)
    .then(() => {
      message.success('已复制到剪贴板');
    })
    .catch(() => {
      message.error('复制失败');
    });
};

// 在Solscan查看
const viewOnSolscan = (mint: string) => {
  window.open(`https://solscan.io/token/${mint}?cluster=devnet`, '_blank');
};

// 组件挂载时加载数据
onMounted(() => {
  if (walletState.value.connected) {
    fetchTokenList();
  }
});

// 监听钱包连接状态变化
watch(() => walletState.value.connected, (isConnected) => {
  if (isConnected) {
    fetchTokenList();
  }
});

// 默认导出
defineOptions({
  name: 'TokenList',
});
</script>

<template>
  <div class="token-list-page">
    <!-- 页面标题区域 -->
    <div class="page-header-section">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">
            <span class="title-icon">💎</span>
            我的代币
          </h1>
          <p class="page-subtitle">管理和查看您的所有代币资产</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" :loading="loading" @click="refreshBalance" size="large">
            <template #icon>🔄</template>
            刷新余额
          </a-button>
        </div>
      </div>
    </div>

    <!-- 资产概览卡片 -->
    <div class="overview-section">
      <div class="overview-cards">
        <div class="overview-card sol-card">
          <div class="card-bg-effect"></div>
          <div class="card-content">
            <div class="card-icon">
              <span class="sol-symbol">◎</span>
            </div>
            <div class="card-info">
              <div class="card-label">SOL 余额</div>
              <div class="card-value">{{ walletBalance.toFixed(4) }}</div>
              <div class="card-unit">SOL</div>
            </div>
          </div>
          <div class="card-glow"></div>
        </div>

        <div class="overview-card tokens-card">
          <div class="card-bg-effect"></div>
          <div class="card-content">
            <div class="card-icon">
              <span>🪙</span>
            </div>
            <div class="card-info">
              <div class="card-label">代币种类</div>
              <div class="card-value">{{ tokens.length }}</div>
              <div class="card-unit">种</div>
            </div>
          </div>
          <div class="card-glow"></div>
        </div>

        <div class="overview-card value-card">
          <div class="card-bg-effect"></div>
          <div class="card-content">
            <div class="card-icon">
              <span>💰</span>
            </div>
            <div class="card-info">
              <div class="card-label">总估值</div>
              <div class="card-value">${{ totalValue.toFixed(2) }}</div>
              <div class="card-unit">USD</div>
            </div>
          </div>
          <div class="card-glow"></div>
        </div>
      </div>
    </div>

    <!-- 未连接钱包提示 -->
    <div v-if="!walletState.value.connected" class="empty-container">
      <div class="empty-state">
        <div class="empty-animation">
          <div class="floating-icon">🔗</div>
        </div>
        <h3 class="empty-title">请先连接钱包</h3>
        <p class="empty-description">连接钱包后即可查看和管理您的代币资产</p>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="tokens.length === 0 && !loading" class="empty-container">
      <div class="empty-state">
        <div class="empty-animation">
          <div class="floating-icon">🪙</div>
        </div>
        <h3 class="empty-title">暂无代币</h3>
        <p class="empty-description">您还没有任何代币，可以去创建新代币</p>
        <a-button type="primary" size="large" @click="$emit('navigate-to', 'create-token')">
          <template #icon>➕</template>
          创建代币
        </a-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-else-if="loading" class="loading-container">
      <a-spin size="large" />
      <p class="loading-text">正在加载代币数据...</p>
    </div>

    <!-- 代币列表 -->
    <div v-else class="tokens-section">
      <div class="section-header">
        <h2 class="section-title">代币列表</h2>
        <div class="section-info">
          <span class="token-count">共 {{ tokens.length }} 个代币</span>
        </div>
      </div>

      <div class="tokens-list">
        <div
          v-for="token in tokens"
          :key="token.mint"
          class="token-item"
        >
          <!-- 代币Logo和信息 -->
          <div class="token-main">
            <div class="token-logo-wrapper">
              <img
                v-if="token.logoURI"
                :src="token.logoURI"
                :alt="token.symbol || 'Token'"
                class="token-logo"
                @error="(e: any) => e.target.style.display = 'none'"
              />
              <div v-else class="token-logo-placeholder">
                {{ token.symbol?.slice(0, 2) || 'TK' }}
              </div>
            </div>

            <div class="token-info">
              <div class="token-name-group">
                <h3 class="token-name">{{ token.name || 'Unknown Token' }}</h3>
                <a-tag class="token-symbol-tag">{{ token.symbol || 'UNKNOWN' }}</a-tag>
              </div>
              <div class="token-address" @click="copyAddress(token.mint)">
                <code>{{ formatAddress(token.mint) }}</code>
                <span class="copy-icon">📋</span>
              </div>
            </div>
          </div>

          <!-- 代币余额 -->
          <div class="token-balance-section">
            <div class="balance-label">持有数量</div>
            <div class="balance-value">
              {{ token.balance.toFixed(token.decimals) }}
            </div>
            <div class="balance-symbol">{{ token.symbol || 'Tokens' }}</div>
          </div>

          <!-- 代币操作 -->
          <div class="token-actions-section">
            <a-space direction="vertical" :size="8" style="width: 100%">
              <a-button type="primary" block size="large" class="action-btn transfer-btn">
                <template #icon>📤</template>
                转账
              </a-button>
              <a-button block size="large" class="action-btn detail-btn" @click="viewOnSolscan(token.mint)">
                <template #icon>🔍</template>
                在 Solscan 查看
              </a-button>
            </a-space>
          </div>

          <!-- ATA地址 -->
          <div class="token-ata-section">
            <div class="ata-label">ATA 地址</div>
            <div class="ata-value" @click="copyAddress(token.ata)">
              <code>{{ formatAddress(token.ata) }}</code>
              <span class="copy-icon">📋</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.token-list-page {
  padding: 0;
  animation: fadeIn 0.3s ease-in;
}

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

/* 页面标题区域 */
.page-header-section {
  margin-bottom: 32px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.title-section {
  flex: 1;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(135deg, #14F195 0%, #9945FF 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  font-size: 36px;
  filter: drop-shadow(0 0 10px rgba(20, 241, 149, 0.5));
}

.page-subtitle {
  margin: 0;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
}

.header-actions {
  flex-shrink: 0;
}

/* 资产概览卡片 */
.overview-section {
  margin-bottom: 40px;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.overview-card {
  position: relative;
  background: linear-gradient(135deg, rgba(26, 34, 53, 0.9) 0%, rgba(11, 19, 43, 0.9) 100%);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 28px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(20px);
}

.overview-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  border-color: rgba(20, 241, 149, 0.5);
}

.overview-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(20, 241, 149, 0.1) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.4s ease;
}

.overview-card:hover::before {
  opacity: 1;
}

.card-bg-effect {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%);
  pointer-events: none;
}

.card-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20px;
  z-index: 1;
}

.card-icon {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  backdrop-filter: blur(10px);
  flex-shrink: 0;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.sol-symbol {
  font-size: 42px;
  color: #14F195;
  filter: drop-shadow(0 0 10px rgba(20, 241, 149, 0.6));
}

.card-info {
  flex: 1;
}

.card-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
  font-weight: 500;
}

.card-value {
  font-size: 36px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1;
  margin-bottom: 6px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.card-unit {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

.card-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(20, 241, 149, 0.15) 0%, transparent 70%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.overview-card:hover .card-glow {
  opacity: 1;
}

.sol-card {
  border-color: rgba(20, 241, 149, 0.3);
}

.tokens-card {
  border-color: rgba(153, 69, 255, 0.3);
}

.value-card {
  border-color: rgba(82, 196, 26, 0.3);
}

/* 空状态 */
.empty-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  padding: 60px 20px;
}

.empty-state {
  text-align: center;
}

.empty-animation {
  margin-bottom: 24px;
}

.floating-icon {
  display: inline-block;
  font-size: 80px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-20px);
  }
}

.empty-title {
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
  color: #ffffff;
}

.empty-description {
  margin: 0 0 32px 0;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 20px;
}

.loading-text {
  margin: 0;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
}

/* 代币列表部分 */
.tokens-section {
  animation: fadeInUp 0.4s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: rgba(26, 34, 53, 0.6);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.section-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
}

.section-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.token-count {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  padding: 6px 12px;
  background: rgba(20, 241, 149, 0.1);
  border-radius: 20px;
  border: 1px solid rgba(20, 241, 149, 0.3);
}

/* 代币列表 */
.tokens-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.token-item {
  background: linear-gradient(135deg, rgba(26, 34, 53, 0.7) 0%, rgba(11, 19, 43, 0.7) 100%);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(20px);
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 24px;
  align-items: start;
}

.token-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
  border-color: rgba(20, 241, 149, 0.4);
}

.token-main {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
}

.token-logo-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(20, 241, 149, 0.2) 0%, rgba(153, 69, 255, 0.2) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.token-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.token-logo-placeholder {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  text-transform: uppercase;
}

.token-info {
  flex: 1;
  min-width: 0;
}

.token-name-group {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.token-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-symbol-tag {
  background: rgba(20, 241, 149, 0.15);
  border: 1px solid rgba(20, 241, 149, 0.4);
  color: #14F195;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.token-address {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.token-address:hover {
  background: rgba(20, 241, 149, 0.1);
  transform: scale(1.02);
}

.token-address code {
  font-family: monospace;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-icon {
  font-size: 14px;
  flex-shrink: 0;
}

/* 余额区域 */
.token-balance-section {
  text-align: right;
  min-width: 120px;
}

.balance-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
  font-weight: 500;
}

.balance-value {
  font-size: 28px;
  font-weight: 700;
  color: #14F195;
  line-height: 1;
  margin-bottom: 6px;
  text-shadow: 0 0 20px rgba(20, 241, 149, 0.4);
}

.balance-symbol {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

/* 操作按钮区域 */
.token-actions-section {
  min-width: 160px;
}

.action-btn {
  height: 44px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.transfer-btn {
  background: linear-gradient(135deg, #14F195 0%, #9945FF 100%);
  border: none;
  color: #0B132B;
}

.transfer-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(20, 241, 149, 0.4);
}

.detail-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.detail-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

/* ATA地址区域 */
.token-ata-section {
  grid-column: 1 / -1;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 12px;
}

.ata-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
  flex-shrink: 0;
}

.ata-value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.ata-value:hover {
  background: rgba(153, 69, 255, 0.1);
  transform: scale(1.02);
}

.ata-value code {
  font-family: monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .token-item {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .token-balance-section {
    text-align: left;
  }

  .token-actions-section {
    min-width: auto;
  }

  .token-ata-section {
    grid-column: auto;
  }
}

@media (max-width: 768px) {
  .page-title {
    font-size: 24px;
  }

  .title-icon {
    font-size: 28px;
  }

  .header-content {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions :deep(.ant-btn) {
    width: 100%;
  }

  .overview-cards {
    grid-template-columns: 1fr;
  }

  .card-value {
    font-size: 28px;
  }

  .token-item {
    padding: 20px;
  }

  .token-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .token-name-group {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
