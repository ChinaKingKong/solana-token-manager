<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import { ReloadOutlined, CopyOutlined, AppstoreOutlined, WalletOutlined, DollarCircleOutlined } from '@ant-design/icons-vue';
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
const walletContext = useWallet() as any;
const walletState = walletContext.walletState;
const network = walletContext.network;
// connection 在 useWallet 中是一个 computed，需要访问 .value
const connection = computed(() => {
  const conn = walletContext.connection;
  // connection 是 computed，需要访问 .value 获取实际的 Connection 对象
  if (conn && typeof conn === 'object' && 'value' in conn) {
    return conn.value;
  }
  return conn;
});
const fetchBalance = walletContext.fetchBalance;

// 代币列表
const tokens = ref<TokenData[]>([]);
const loading = ref(false);

// 分页相关
const currentPage = ref(1);
const pageSize = ref(6); // 每页显示6个代币（2行x3列，或3行x2列）

// 计算分页后的代币列表
const paginatedTokens = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return tokens.value.slice(start, end);
});

// 处理分页变化
const handlePageChange = (page: number) => {
  currentPage.value = page;
  // 滚动到列表顶部
  const listContainer = document.querySelector('.tokens-list-container');
  if (listContainer) {
    listContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// 监听代币列表变化，重置到第一页
watch(() => tokens.value.length, () => {
  currentPage.value = 1;
});

// SOL余额
const walletBalance = computed(() => {
  return walletState.value?.balance ?? 0;
});

// 调试信息
const debugInfo = ref({
  lastFetchTime: null as Date | null,
  errorCount: 0,
  lastError: null as string | null,
});

// 刷新余额
const refreshBalance = async () => {
  if (!walletState.value || !walletState.value.connected) {
    message.error('请先连接钱包');
    return;
  }

  try {
    await fetchBalance();
    await fetchTokenList();
    message.success('余额已更新');
  } catch (error) {
    message.error('获取余额失败');
  }
};

// 获取代币列表
const fetchTokenList = async () => {
  if (!walletState.value) {
    return;
  }

  if (!walletState.value.connected) {
    return;
  }

  if (!walletState.value.publicKey) {
    message.error('钱包公钥无效，请重新连接钱包');
    return;
  }

  loading.value = true;

  // 定义直接 RPC 调用方法
  const fetchTokenAccountsDirectRPC = async () => {
    const publicKey = walletState.value.publicKey!;

    // Solana RPC getTokenAccountsByOwner 的正确参数格式：
    // 1. owner (公钥字符串)
    // 2. filter 对象: { mint: ... } 或 { programId: ... }
    // 3. config 对象: { encoding: ... }
    const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

    const conn = connection.value;
    const response = await fetch(conn.rpcEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          publicKey.toBase58(),
          {
            programId: TOKEN_PROGRAM_ID
          },
          {
            encoding: 'jsonParsed'
          }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.result;
  };

  try {
    const conn = connection.value;

    if (!conn) {
      throw new Error('Connection对象未初始化');
    }

    // 确保 PublicKey 对象有效
    const publicKey = walletState.value.publicKey;

    let tokenAccountsResponse;

    // 尝试使用 getTokenAccountsByOwner 方法
    // 如果失败则使用直接的 RPC 调用
    try {
      if (!publicKey) {
        throw new Error('PublicKey 对象无效');
      }
      tokenAccountsResponse = await conn.getTokenAccountsByOwner(
        publicKey,
        {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        },
        {
          encoding: 'jsonParsed'
        }
      );
    } catch (error1: any) {
      tokenAccountsResponse = await fetchTokenAccountsDirectRPC();
    }

    const tokenList: TokenData[] = [];

    // getTokenAccountsByOwner 返回 { context, value } 结构
    const accounts = tokenAccountsResponse.value || [];

    for (const account of accounts) {
      try {
        // 安全检查
        if (!account || !account.account || !account.account.data) {
          continue;
        }

        const accountData = account.account.data;

        // 检查 parsed 数据
        if (!accountData.parsed || !accountData.parsed.info) {
          continue;
        }

        const parsedData = accountData.parsed;
        const tokenAmount = parsedData.info.tokenAmount;

        // 检查 pubkey
        if (!account.pubkey) {
          continue;
        }

        const pubkeyString = account.pubkey.toString ? account.pubkey.toString() : String(account.pubkey);

        // 显示所有代币，包括余额为0的
        tokenList.push({
          mint: parsedData.info.mint,
          ata: pubkeyString,
          balance: parseFloat(tokenAmount.uiAmount || '0'),
          decimals: tokenAmount.decimals,
        });
      } catch (error) {
        // 忽略单个代币账户处理错误
      }
    }

    tokens.value = tokenList;

    // 获取代币元数据
    await fetchTokenMetadata();

  } catch (error: any) {
    message.error(`获取代币列表失败: ${error.message || '未知错误'}`);

    // 更新调试信息
    debugInfo.value.errorCount++;
    debugInfo.value.lastError = error.message || '未知错误';
    debugInfo.value.lastFetchTime = new Date();

    // 检查是否是网络问题
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      message.warning('网络连接问题，请检查网络连接');
    }

    // 检查是否是RPC问题
    if (error.message?.includes('timeout') || error.message?.includes('RPC')) {
      message.warning('RPC节点响应超时，请稍后重试');
    }
  } finally {
    loading.value = false;
    debugInfo.value.lastFetchTime = new Date();
  }
};

// 获取代币元数据
const fetchTokenMetadata = async () => {
  try {

    const response = await fetch('https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

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

  } catch (error: any) {
    // 元数据获取失败不影响显示，只是没有图标和名称
    message.warning('获取代币元数据失败，将显示默认信息');
  }
};

// 稳定币列表（价格固定为 1 USD）
const stableCoins = ['USDT', 'USDC', 'USD', 'USDC-Dev', 'USDT-Dev'];

// 获取代币的 USD 价格
const getTokenPrice = (token: TokenData): number => {
  // 如果代币有价格，直接使用
  if (token.price) {
    return token.price;
  }
  
  // 如果是稳定币，价格为 1 USD
  if (token.symbol && stableCoins.includes(token.symbol.toUpperCase())) {
    return 1;
  }
  
  // 其他代币暂时返回 0（可以后续接入价格 API）
  return 0;
};

// 计算总价值（按 USDT 1:1 转换为 USD）
const totalValue = computed(() => {
  return tokens.value.reduce((sum, token) => {
    const price = getTokenPrice(token);
    const tokenValue = token.balance * price;
    return sum + tokenValue;
  }, 0);
});

// 格式化地址
const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
};

// 复制地址
const copyAddress = (address: string, type: string = '地址') => {
  navigator.clipboard.writeText(address)
    .then(() => {
      message.success(`${type}已复制到剪贴板`);
    })
    .catch(() => {
      message.error('复制失败');
    });
};

// 转账功能
const handleTransfer = (token: TokenData) => {
  // 触发转账事件，传递代币信息
  message.info(`转账功能开发中，代币: ${token.symbol || 'Unknown'}`);
  // TODO: 导航到转账页面并传递代币信息
};

// 在Solscan查看
const viewOnSolscan = (mint: string) => {
  window.open(`https://solscan.io/token/${mint}?cluster=devnet`, '_blank');
};

// 组件挂载时加载数据
onMounted(() => {
  if (walletState.value && walletState.value.connected) {
    fetchTokenList();
  }
});

// 监听钱包连接状态变化
watch(() => walletState.value?.connected, (isConnected) => {
  if (isConnected) {
    fetchTokenList();
  } else {
    // 断开连接时清空代币列表
    tokens.value = [];
    currentPage.value = 1;
  }
});

// 监听网络变化
watch(() => network.value, (newNetwork, oldNetwork) => {
  if (oldNetwork && newNetwork !== oldNetwork) {
    // 网络切换时清空代币列表
    tokens.value = [];
    currentPage.value = 1;
    // 如果钱包已连接，重新获取代币列表
    if (walletState.value?.connected) {
      fetchTokenList();
    }
  }
});

// 默认导出
defineOptions({
  name: 'TokenList',
});
</script>

<template>
  <div class="p-0 w-full max-w-full animate-[fadeIn_0.3s_ease-in] h-full flex flex-col">
    <!-- 资产概览卡片 -->
    <div class="shrink-0 mt-3">
      <div class="flex flex-row gap-6 flex-nowrap w-full">
        <div
          class="overview-card relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border-2 border-[rgba(20,241,149,0.3)] rounded-2xl p-4 overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] flex-1 min-w-0 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(20,241,149,0.5)]">
          <div
            class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
          </div>
          <div class="relative flex items-center gap-4 z-[1]">
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-[10px] shrink-0 shadow-[0_8px_16px_rgba(0,0,0,0.2)]">
              <WalletOutlined class="text-[28px] text-solana-green" />
            </div>
            <div class="flex-1 min-w-0 overflow-hidden">
              <div class="flex items-baseline gap-2">
                <div class="text-lg font-bold text-white leading-tight break-words"
                  style="text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);">{{ walletBalance.toFixed(4) }}</div>
                <div class="text-sm text-white/50 font-medium">SOL</div>
              </div>
            </div>
          </div>
          <div class="card-glow"></div>
        </div>

        <div
          class="overview-card relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border-2 border-[rgba(153,69,255,0.3)] rounded-2xl p-4 overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] flex-1 min-w-0 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(153,69,255,0.5)]">
          <div
            class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
          </div>
          <div class="relative flex items-center gap-4 z-[1]">
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-[10px] shrink-0 shadow-[0_8px_16px_rgba(0,0,0,0.2)]">
              <AppstoreOutlined class="text-[28px] text-white/90" />
            </div>
            <div class="flex-1 min-w-0 overflow-hidden">
              <div class="flex items-baseline gap-2">
                <div class="text-lg font-bold text-white leading-tight break-words"
                  style="text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);">{{ tokens.length }}</div>
                <div class="text-sm text-white/50 font-medium">Tokens</div>
              </div>
            </div>
          </div>
          <div class="card-glow"></div>
        </div>

        <div
          class="overview-card relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border-2 border-[rgba(82,196,26,0.3)] rounded-2xl p-4 overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] flex-1 min-w-0 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(82,196,26,0.5)]">
          <div
            class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
          </div>
          <div class="relative flex items-center gap-4 z-[1]">
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-[10px] shrink-0 shadow-[0_8px_16px_rgba(0,0,0,0.2)]">
              <DollarCircleOutlined class="text-[28px] text-white/90" />
            </div>
            <div class="flex-1 min-w-0 overflow-hidden">
              <div class="flex items-baseline gap-2">
                <div class="text-lg font-bold text-white leading-tight break-words"
                  style="text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);">${{ totalValue.toFixed(2) }}</div>
                <div class="text-sm text-white/50 font-medium">USD</div>
              </div>
            </div>
          </div>
          <div class="card-glow"></div>
        </div>
      </div>
    </div>

    <!-- 未连接钱包提示 -->
    <div v-if="!walletState || !walletState.connected" class="flex items-center justify-center min-h-[400px]">
      <div class="text-center">
        <div class="mb-6 animate-bounce">
          <div class="text-6xl">🔗</div>
        </div>
        <h3 class="text-2xl font-bold text-white mb-2">请先连接钱包</h3>
        <p class="text-white/60">连接钱包后即可查看和管理您的代币资产</p>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="tokens.length === 0 && !loading" class="flex items-center justify-center min-h-[400px]">
      <a-empty description="暂无代币">
        <template #description>
          <span class="text-white/65">您还没有任何代币，可以去创建新代币</span>
        </template>
        <a-button type="primary" size="large" @click="$emit('navigate-to', 'create-token')">
          <template #icon>➕</template>
          创建代币
        </a-button>
      </a-empty>
    </div>

    <!-- 加载状态 -->
    <div v-else-if="loading" class="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <a-spin size="large" />
      <p class="text-white/80">正在加载代币数据...</p>
    </div>

    <!-- 代币列表 -->
    <div v-else class="flex-1 flex flex-col min-h-0 overflow-hidden h-full animate-[fadeInUp_0.4s_ease-out] mt-5">
      <!-- 标题区域 -->
      <div
        class="flex justify-between items-center mb-6 px-6 py-4 bg-[rgba(26,34,53,0.6)] rounded-2xl border border-white/10 backdrop-blur-[10px]">
        <h2 class="m-0 text-xl font-semibold text-white">代币列表</h2>
        <div class="flex items-center gap-3">
          <span
            class="px-3 py-1.5 text-xs font-medium text-solana-green bg-[rgba(20,241,149,0.1)] rounded-full border border-[rgba(20,241,149,0.2)]">共
            {{ tokens.length }} 个代币</span>
          <a-button :loading="loading" @click="refreshBalance" size="default"
            class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
            <template #icon>
              <ReloadOutlined />
            </template>
            刷新余额
          </a-button>
        </div>
      </div>

      <!-- 调试信息面板 -->
      <div v-if="debugInfo.lastError"
        class="mb-6 p-4 bg-[rgba(255,193,7,0.1)] border border-[rgba(255,193,7,0.3)] rounded-lg">
        <div class="flex justify-between items-center mb-3">
          <span class="text-base font-semibold text-[#ffc107]">⚠️ 调试信息</span>
          <a-button size="small" @click="debugInfo.lastError = null">关闭</a-button>
        </div>
        <div class="space-y-2">
          <div class="flex gap-3 p-2 bg-black/20 rounded-lg">
            <span class="text-[13px] text-white/60 font-medium min-w-[100px]">错误信息:</span>
            <span class="text-[13px] text-white font-mono break-all">{{ debugInfo.lastError }}</span>
          </div>
          <div class="flex gap-3 p-2 bg-black/20 rounded-lg">
            <span class="text-[13px] text-white/60 font-medium min-w-[100px]">错误次数:</span>
            <span class="text-[13px] text-white font-mono break-all">{{ debugInfo.errorCount }}</span>
          </div>
          <div class="flex gap-3 p-2 bg-black/20 rounded-lg">
            <span class="text-[13px] text-white/60 font-medium min-w-[100px]">最后尝试:</span>
            <span class="text-[13px] text-white font-mono break-all">{{ debugInfo.lastFetchTime?.toLocaleString()
            }}</span>
          </div>
          <div class="flex gap-3 p-2 bg-black/20 rounded-lg">
            <span class="text-[13px] text-white/60 font-medium min-w-[100px]">钱包公钥:</span>
            <span class="text-[13px] text-white font-mono break-all">{{ walletState.publicKey?.toString() }}</span>
          </div>
          <div class="mt-2">
            <p class="m-0 mb-2 text-sm text-[#ffc107]"><strong>可能的问题:</strong></p>
            <ul class="m-0 pl-5">
              <li class="text-[13px] text-white/80 mb-1">钱包中可能没有任何SPL Token</li>
              <li class="text-[13px] text-white/80 mb-1">RPC节点连接问题（Devnet可能不稳定）</li>
              <li class="text-[13px] text-white/80 mb-1">网络延迟或超时</li>
              <li class="text-[13px] text-white/80 mb-1">尝试先创建一个代币，然后再查看列表</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto pr-2 px-2">
        <div class="grid grid-cols-4 gap-4">
          <div v-for="token in paginatedTokens" :key="token.mint"
            class="token-card bg-gradient-to-br from-[rgba(26,34,53,0.8)] to-[rgba(11,19,43,0.8)] border border-white/10 rounded-xl p-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] relative overflow-hidden w-full box-border flex flex-col gap-3 hover:border-[rgba(20,241,149,0.3)] hover:shadow-[0_8px_32px_rgba(20,241,149,0.15)]">
            <!-- 代币Logo和信息 -->
            <div class="flex items-start gap-3">
              <div
                class="w-12 h-12 shrink-0 rounded-full overflow-hidden bg-white/5 flex items-center justify-center border border-white/10">
                <img v-if="token.logoURI" :src="token.logoURI" :alt="token.symbol || 'Token'"
                  class="w-full h-full object-cover" @error="(e: any) => e.target.style.display = 'none'" />
                <div v-else
                  class="w-full h-full flex items-center justify-center bg-gradient-solana text-white font-bold text-sm">
                  {{ token.symbol?.slice(0, 2) || 'TK' }}
                </div>
              </div>

              <div class="flex-1 min-w-0 overflow-hidden">
                <div class="flex items-center gap-2 mb-2">
                  <h3 class="m-0 text-base font-semibold text-white truncate">{{ token.name || 'Unknown Token' }}</h3>
                  <a-tag
                    class="px-2 py-0.5 text-xs font-medium text-solana-green bg-[rgba(20,241,149,0.1)] border border-[rgba(20,241,149,0.2)] rounded-full">{{
                      token.symbol || 'UNKNOWN' }}</a-tag>
                </div>
                <div class="space-y-1.5">
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] text-white/60 font-medium min-w-[35px]">数量</span>
                    <div
                      class="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded cursor-pointer hover:bg-white/10 transition-colors flex-1 min-w-0">
                      <div class="text-[11px] text-white/80 font-mono truncate flex-1">
                        {{ token.balance.toFixed(token.decimals) }}
                      </div> 
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] text-white/60 font-medium min-w-[35px]">Mint</span>
                    <div
                      class="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded cursor-pointer hover:bg-white/10 transition-colors flex-1 min-w-0"
                      @click="copyAddress(token.mint, 'Mint地址')">
                      <code class="text-[11px] text-white/80 font-mono truncate flex-1">{{ formatAddress(token.mint)
                      }}</code>
                      <CopyOutlined class="text-[11px] shrink-0 text-white/60" />
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] text-white/60 font-medium min-w-[35px]">ATA</span>
                    <div
                      class="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded cursor-pointer hover:bg-white/10 transition-colors flex-1 min-w-0"
                      @click="copyAddress(token.ata, 'ATA地址')">
                      <code class="text-[11px] text-white/80 font-mono truncate flex-1">{{ formatAddress(token.ata)
                      }}</code>
                      <CopyOutlined class="text-[11px] shrink-0 text-white/60" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 代币操作按钮 -->
            <div class="mt-auto">
              <div class="flex gap-2">
                <button
                  @click="handleTransfer(token)"
                  class="flex items-center justify-center flex-1 px-3 py-1.5 text-xs font-medium rounded-full bg-[rgba(20,241,149,0.1)] border border-[rgba(20,241,149,0.2)] text-solana-green transition-all duration-300 ease-in-out hover:bg-[rgba(20,241,149,0.15)] hover:border-[rgba(20,241,149,0.3)] cursor-pointer"
                >
                  <span class="mr-1">📤</span>
                  转账
                </button>
                <button
                  @click="viewOnSolscan(token.mint)"
                  class="flex items-center justify-center flex-1 px-3 py-1.5 text-xs font-medium rounded-full bg-[rgba(153,69,255,0.1)] border border-[rgba(153,69,255,0.2)] text-white transition-all duration-300 ease-in-out hover:bg-[rgba(153,69,255,0.15)] hover:border-[rgba(153,69,255,0.3)] cursor-pointer"
                >
                  <span class="mr-1">🔍</span>
                  Solscan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页组件 -->
      <div v-if="tokens.length > pageSize" class="mt-4 flex justify-center">
        <a-pagination v-model:current="currentPage" :total="tokens.length" :page-size="pageSize"
          :show-size-changer="false" :show-quick-jumper="true"
          :show-total="(total: number, range: [number, number]) => `共 ${total} 个代币，第 ${range[0]}-${range[1]} 个`"
          @change="handlePageChange"
          class="[&_.ant-pagination-item]:bg-white/10 [&_.ant-pagination-item]:border-white/20 [&_.ant-pagination-item]:text-white [&_.ant-pagination-item:hover]:border-solana-green [&_.ant-pagination-item-active]:bg-solana-green [&_.ant-pagination-item-active]:border-solana-green [&_.ant-pagination-prev]:text-white [&_.ant-pagination-next]:text-white [&_.ant-pagination-jump-prev]:text-white [&_.ant-pagination-jump-next]:text-white" />
      </div>
    </div>
  </div>
</template>

<style scoped>
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

/* 资产概览卡片特殊效果 */
.overview-card {
  position: relative;
  overflow: hidden;
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


/* Empty 组件样式 */
:deep(.ant-empty) {
  color: rgba(255, 255, 255, 0.65);
}

:deep(.ant-empty-description) {
  color: rgba(255, 255, 255, 0.65);
}

:deep(.ant-empty-image) {
  opacity: 0.6;
}

/* 自定义滚动条样式 */
.tokens-list-container::-webkit-scrollbar {
  width: 6px;
}

.tokens-list-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.tokens-list-container::-webkit-scrollbar-thumb {
  background: rgba(20, 241, 149, 0.3);
  border-radius: 3px;
}

.tokens-list-container::-webkit-scrollbar-thumb:hover {
  background: rgba(20, 241, 149, 0.5);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .tokens-list-container {
    max-height: calc(100vh - 480px);
  }
}

@media (max-width: 768px) {
  .overview-cards {
    flex-direction: column;
  }
}
</style>
