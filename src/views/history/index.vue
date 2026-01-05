<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n'; 
import { useWallet } from '../../hooks/useWallet';

const { t } = useI18n();
import {
  ReloadOutlined,
  CopyOutlined,
  GlobalOutlined,
  WalletOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons-vue';

// 使用钱包Hook
const walletContext = useWallet();
const walletState = walletContext.walletState;
const connection = computed(() => walletContext.connection.value);
const network = walletContext.network;

// 交易历史数据
const transactions = ref<any[]>([]);
const loading = ref(false);
const currentSignature = ref('');

// 分页相关
const currentPage = ref(1);
const pageSize = ref(10);

// 签名详情
const selectedTransaction = ref<any>(null);
const detailModalVisible = ref(false);

// 统计信息
const stats = computed(() => {
  const total = transactions.value.length;
  const success = transactions.value.filter(t => !t.err).length;
  const failed = transactions.value.filter(t => t.err).length;
  return { total, success, failed };
});

// 分页后的交易列表
const paginatedTransactions = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return transactions.value.slice(start, end);
});

// 处理分页变化
const handlePageChange = (page: number) => {
  currentPage.value = page;
  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 获取交易历史
const fetchTransactionHistory = async () => {
  if (!walletState.value?.connected || !walletState.value?.publicKey) {
    message.error(t('wallet.connectWallet'));
    return;
  }

  loading.value = true;

  try {
    const conn = connection.value;
    const publicKey = walletState.value.publicKey;

    const signatures = await conn.getSignaturesForAddress(
      publicKey,
      { limit: 500 }
    );

    const transactionDetails = await Promise.all(
      signatures.map(async (sig) => {
        try {
          const tx = await conn.getParsedTransaction(sig.signature, 'confirmed');
          return {
            signature: sig.signature,
            slot: sig.slot,
            blockTime: sig.blockTime,
            confirmationStatus: sig.confirmationStatus,
            err: sig.err,
            parsed: tx
          };
        } catch (error) {
          return {
            signature: sig.signature,
            slot: sig.slot,
            blockTime: sig.blockTime,
            confirmationStatus: sig.confirmationStatus,
            err: sig.err,
            parsed: null
          };
        }
      })
    );

    transactions.value = transactionDetails;
    currentPage.value = 1; // 重置到第一页
    message.success(t('transactionHistory.loadSuccess', { count: transactionDetails.length }));
  } catch (error) {
    message.error(t('transactionHistory.loadFailed'));
  } finally {
    loading.value = false;
  }
};

// 查看交易详情
const viewTransactionDetail = async (signature: string) => {
  currentSignature.value = signature;
  
  // 先从已加载的交易列表中查找
  const existingTx = transactions.value.find(tx => tx.signature === signature);
  
  if (existingTx) {
    // 直接使用已加载的数据
    selectedTransaction.value = existingTx;
    detailModalVisible.value = true;
    return;
  }

  // 如果未找到，重新获取
  loading.value = true;
  detailModalVisible.value = true;

  try {
    const conn = connection.value;
    const tx = await conn.getParsedTransaction(signature, 'confirmed');
    
    // 获取签名信息
    const allSigs = await conn.getSignaturesForAddress(
      walletState.value!.publicKey!,
      { limit: 500 }
    );
    const sigInfo = allSigs.find(sig => sig.signature === signature);
    
    // 使用与 fetchTransactionHistory 相同的数据结构
    selectedTransaction.value = {
      signature,
      slot: sigInfo?.slot || null,
      blockTime: sigInfo?.blockTime || null,
      confirmationStatus: sigInfo?.confirmationStatus || null,
      err: sigInfo?.err || null,
      parsed: tx
    };
  } catch (error) {
    message.error(t('transactionHistory.fetchDetailFailed'));
    // 即使失败也显示基本信息
    selectedTransaction.value = {
      signature,
      slot: null,
      blockTime: null,
      confirmationStatus: null,
      err: null,
      parsed: null
    };
  } finally {
    loading.value = false;
  }
};

// 复制签名到剪贴板
const copySignature = (signature: string) => {
  navigator.clipboard.writeText(signature)
    .then(() => {
      message.success(t('wallet.addressCopied'));
    })
    .catch(() => {
      message.error(t('common.error'));
    });
};

// 在Solscan explorer中查看
const viewOnExplorer = (signature: string) => {
  const cluster = network.value === 'mainnet' ? '' : `?cluster=${network.value}`;
  window.open(`https://solscan.io/tx/${signature}${cluster}`, '_blank');
};

// 格式化时间
const formatTime = (timestamp: number | null) => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString('zh-CN');
};

// 获取交易状态
const getStatus = (tx: any) => {
  if (tx.err) {
    return { text: t('transactionHistory.statusFailed'), color: 'error', icon: CloseCircleOutlined };
  }
  if (tx.confirmationStatus === 'finalized') {
    return { text: t('transactionHistory.statusConfirmed'), color: 'success', icon: CheckCircleOutlined };
  }
  if (tx.confirmationStatus === 'confirmed') {
    return { text: t('transactionHistory.statusConfirmed'), color: 'processing', icon: CheckCircleOutlined };
  }
  return { text: t('transactionHistory.statusProcessing'), color: 'default', icon: ClockCircleOutlined };
};

// 获取交易类型
const getTransactionType = (tx: any) => {
  if (!tx.parsed || !tx.parsed.transaction || !tx.parsed.transaction.message) {
    return t('transactionHistory.typeUnknown');
  }

  const instructions = tx.parsed.transaction.message.instructions;
  if (!instructions || instructions.length === 0) {
    return t('transactionHistory.typeSolTransfer');
  }

  // 检查第一条指令的类型
  const firstInstruction = instructions[0];
  if (firstInstruction.programId) {
    const programId = typeof firstInstruction.programId === 'string'
      ? firstInstruction.programId
      : firstInstruction.programId.toString();

    // Token Program
    if (programId.includes('Token')) {
      if (firstInstruction.parsed && firstInstruction.parsed.type) {
        const type = firstInstruction.parsed.type;
        const typeMap: Record<string, string> = {
          'transfer': t('transactionHistory.typeTokenTransfer'),
          'transferChecked': t('transactionHistory.typeTokenTransfer'),
          'mintTo': t('transactionHistory.typeMintToken'),
          'mintToChecked': t('transactionHistory.typeMintToken'),
          'burn': t('transactionHistory.typeBurnToken'),
          'burnChecked': t('transactionHistory.typeBurnToken'),
          'freezeAccount': t('transactionHistory.typeFreezeAccount'),
          'thawAccount': t('transactionHistory.typeThawAccount'),
        };
        return typeMap[type] || t('transactionHistory.typeTokenOperation');
      }
      return t('transactionHistory.typeTokenOperation');
    }

    // System Program
    if (programId.includes('System')) {
      return t('transactionHistory.typeSolTransfer');
    }
  }

  return t('transactionHistory.typeOther');
};

// 格式化地址
const formatAddress = (address: string | number | null | undefined) => {
  if (!address) return '';
  const addressStr = String(address);
  return `${addressStr.slice(0, 12)}.....${addressStr.slice(-12)}`;
};

// 解析代币转账详情
const parseTokenTransfer = (instruction: any) => {
  if (!instruction.parsed) return null;

  const info = instruction.parsed.info;
  return {
    type: t('transactionHistory.typeTokenTransfer'),
    source: info.source || info.authority || 'N/A',
    destination: info.destination || 'N/A',
    amount: info.amount ? info.amount : (info.tokenAmount?.amount || '0'),
    decimals: info.tokenAmount?.decimals || 0,
    mint: info.mint || 'N/A',
    tokenAmount: info.tokenAmount
      ? `${(Number(info.tokenAmount.amount) / Math.pow(10, info.tokenAmount.decimals)).toFixed(info.tokenAmount.decimals)}`
      : '0'
  };
};

// 解析 SOL 转账详情
const parseSolTransfer = (instruction: any, accounts: string[]) => {
  if (!instruction.parsed) return null;

  const info = instruction.parsed.info;
  return {
    type: t('transactionHistory.typeSolTransfer'),
    source: info.source ? formatAddress(info.source) : (accounts[0] ? formatAddress(accounts[0]) : 'N/A'),
    destination: info.destination ? formatAddress(info.destination) : (accounts[1] ? formatAddress(accounts[1]) : 'N/A'),
    lamports: info.lamports || '0',
    solAmount: info.lamports ? `${(Number(info.lamports) / 1e9).toFixed(9)} ${t('transactionHistory.solUnit')}` : `0 ${t('transactionHistory.solUnit')}`
  };
};

// 解析代币铸造详情
const parseMintTo = (instruction: any) => {
  if (!instruction.parsed) return null;

  const info = instruction.parsed.info;
  return {
    type: t('transactionHistory.typeMintToken'),
    mint: info.mint ? formatAddress(info.mint) : 'N/A',
    destination: info.destination ? formatAddress(info.destination) : 'N/A',
    authority: info.authority ? formatAddress(info.authority) : 'N/A',
    amount: info.tokenAmount?.amount || info.amount || '0',
    decimals: info.tokenAmount?.decimals || 0,
    tokenAmount: info.tokenAmount
      ? `${(Number(info.tokenAmount.amount) / Math.pow(10, info.tokenAmount.decimals)).toFixed(info.tokenAmount.decimals)}`
      : '0'
  };
};

// 解析代币销毁详情
const parseBurn = (instruction: any) => {
  if (!instruction.parsed) return null;

  const info = instruction.parsed.info;
  return {
    type: t('transactionHistory.typeBurnToken'),
    account: info.account ? formatAddress(info.account) : 'N/A',
    authority: info.authority ? formatAddress(info.authority) : 'N/A',
    amount: info.tokenAmount?.amount || info.amount || '0',
    decimals: info.tokenAmount?.decimals || 0,
    mint: info.mint ? formatAddress(info.mint) : 'N/A'
  };
};

// 解析交易指令详情
const parseInstructionDetails = (instruction: any, index: string | number, allAccounts: string[]) => {
  const indexNum = typeof index === 'string' ? parseInt(index, 10) : index;
  const programId = typeof instruction.programId === 'string'
    ? instruction.programId
    : instruction.programId?.toString() || 'Unknown';

  let details: any = {
    index: indexNum + 1,
    programId: formatAddress(programId),
    programName: getProgramName(programId)
  };

  // Token Program 指令
  if (programId.includes('Token')) {
    if (instruction.parsed?.type === 'transfer' || instruction.parsed?.type === 'transferChecked') {
      details = { ...details, ...parseTokenTransfer(instruction) };
    } else if (instruction.parsed?.type === 'mintTo' || instruction.parsed?.type === 'mintToChecked') {
      details = { ...details, ...parseMintTo(instruction) };
    } else if (instruction.parsed?.type === 'burn' || instruction.parsed?.type === 'burnChecked') {
      details = { ...details, ...parseBurn(instruction) };
    } else {
      details.type = instruction.parsed?.type || t('transactionHistory.typeTokenOperation');
      details.raw = instruction.parsed?.info || {};
    }
  }
  // System Program 指令
  else if (programId.includes('System')) {
    if (instruction.parsed?.type === 'transfer') {
      details = { ...details, ...parseSolTransfer(instruction, allAccounts) };
    } else {
      details.type = instruction.parsed?.type || t('transactionHistory.typeSystemOperation');
      details.raw = instruction.parsed?.info || {};
    }
  }
  // 其他程序
  else {
    details.type = instruction.parsed?.type || t('transactionHistory.typeOtherOperation');
    details.raw = instruction.parsed || instruction;
  }

  return details;
};

// 获取程序名称
const getProgramName = (programId: string) => {
  if (programId.includes('Token')) return 'Token Program';
  if (programId.includes('System')) return 'System Program';
  if (programId.includes('ComputeBudget')) return 'Compute Budget Program';
  if (programId.includes('Stake')) return 'Stake Program';
  if (programId.includes('Config')) return 'Config Program';
  if (programId.includes('Vote')) return 'Vote Program';
  if (programId.includes('Memo')) return 'Memo Program';
  return formatAddress(programId);
};

// 获取账户变更信息
const getAccountChanges = (tx: any) => {
  if (!tx.parsed?.meta) return [];

  const { preBalances, postBalances, accountKeys } = tx.parsed.meta;
  if (!preBalances || !postBalances || !accountKeys) return [];

  const changes = [];
  for (let i = 0; i < accountKeys.length; i++) {
    const preBalance = Number(preBalances[i]) / 1e9;
    const postBalance = Number(postBalances[i]) / 1e9;
    const change = postBalance - preBalance;

    if (change !== 0) {
      changes.push({
        address: typeof accountKeys[i] === 'string'
          ? accountKeys[i]
          : accountKeys[i].toString(),
        preBalance: preBalance.toFixed(9),
        postBalance: postBalance.toFixed(9),
        change: change.toFixed(9)
      });
    }
  }

  return changes;
};

// 获取交易日志
const getTransactionLogs = (tx: any) => {
  if (!tx.parsed?.meta?.logMessages) return [];
  return tx.parsed.meta.logMessages;
};

// 监听钱包连接状态
watch(() => walletState.value?.connected, (isConnected) => {
  if (isConnected && walletState.value?.publicKey) {
    fetchTransactionHistory();
  } else {
    transactions.value = [];
    currentPage.value = 1;
  }
});

// 监听钱包公钥变化（钱包切换）
watch(() => walletState.value?.publicKey?.toBase58(), (newPublicKey, oldPublicKey) => {
  // 当公钥变化且钱包已连接时，刷新交易历史
  if (walletState.value?.connected) {
    if (newPublicKey && oldPublicKey && newPublicKey !== oldPublicKey) {
      // 钱包切换：清空列表并重新加载
      transactions.value = [];
      currentPage.value = 1;
      fetchTransactionHistory();
    } else if (newPublicKey && !oldPublicKey) {
      // 新连接：加载交易历史
      fetchTransactionHistory();
    } else if (!newPublicKey && oldPublicKey) {
      // 断开连接：清空列表
      transactions.value = [];
      currentPage.value = 1;
    }
  }
});

// 组件挂载时加载交易历史
onMounted(() => {
  if (walletState.value?.connected && walletState.value?.publicKey) {
    fetchTransactionHistory();
  }
});

// 默认导出
defineOptions({
  name: 'TransactionHistory',
});
</script>

<template>
  <div class="p-0 w-full max-w-full animate-[fadeIn_0.3s_ease-in] min-h-full flex flex-col">
    <!-- 未连接钱包提示 -->
    <div v-if="!walletState || !walletState.connected" class="flex items-center justify-center min-h-[400px] flex-1">
      <div class="text-center">
        <div class="mb-6 animate-bounce">
          <WalletOutlined class="text-6xl text-white/30" />
        </div>
        <h3 class="text-2xl font-bold text-white mb-2">{{ t('transactionHistory.connectWalletFirst') }}</h3>
        <p class="text-white/60">{{ t('transactionHistory.connectWalletDesc') }}</p>
      </div>
    </div>

    <!-- 交易历史内容 -->
    <div v-else class="w-full py-3">
      <div
        class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border border-white/10 rounded-2xl p-6 overflow-visible transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(20,241,149,0.3)] hover:shadow-[0_8px_32px_rgba(20,241,149,0.15)]">
        <div
          class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none">
        </div>
        <div class="relative z-[1] space-y-6">
          <!-- 标题和刷新按钮 -->
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 class="m-0 text-2xl font-semibold text-white">{{ t('transactionHistory.title') }}</h2>
      <a-button
        type="primary"
        :loading="loading"
        @click="fetchTransactionHistory"
              class="flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-2.5 h-auto text-[15px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300">
        <template #icon>
          <ReloadOutlined />
        </template>
              {{ t('transactionHistory.refresh') }}
      </a-button>
    </div>

      <!-- 交易统计 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10">
                  <HistoryOutlined class="text-2xl text-solana-green" />
      </div>
                <div>
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('transactionHistory.total') }}</div>
                  <div class="text-2xl font-bold text-white">{{ stats.total }}</div>
              </div>
              </div>
            </div>
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10">
                  <CheckCircleOutlined class="text-2xl text-green-400" />
                </div>
                <div>
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('transactionHistory.success') }}</div>
                  <div class="text-2xl font-bold text-green-400">{{ stats.success }}</div>
                </div>
              </div>
            </div>
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10">
                  <CloseCircleOutlined class="text-2xl text-red-400" />
                </div>
                <div>
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('transactionHistory.failed') }}</div>
                  <div class="text-2xl font-bold text-red-400">{{ stats.failed }}</div>
                </div>
              </div>
            </div>
            <div class="bg-white/5 rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10">
                  <ClockCircleOutlined class="text-2xl text-blue-400" />
                </div>
                <div>
                  <div class="text-xs font-medium text-white/60 mb-1">{{ t('transactionHistory.latest') }}</div>
                  <div class="text-sm font-semibold text-white">
                    {{ transactions.length > 0 ? formatTime(transactions[0].blockTime) : 'N/A' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 交易列表 -->
          <div v-if="transactions.length > 0" class="space-y-3">
            <div
              v-for="tx in paginatedTransactions"
              :key="tx.signature"
              class="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-[rgba(20,241,149,0.3)] transition-all duration-300 cursor-pointer"
              @click="viewTransactionDetail(tx.signature)">
              <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1 mb-2">
                    <component :is="getStatus(tx).icon" :class="`text-${getStatus(tx).color === 'error' ? 'red' : getStatus(tx).color === 'success' ? 'green' : 'blue'}-400`" />
                    <a-tag :color="getStatus(tx).color">
                      {{ getStatus(tx).text }}
              </a-tag>
                    <a-tag>{{ getTransactionType(tx) }}</a-tag>
                  </div>
                  <div class="flex items-center gap-2 mb-1">
                    <code class="text-xs text-white/70 font-mono">{{ formatAddress(tx.signature) }}</code>
                <a-button
                      type="text"
                  size="small"
                      @click.stop="copySignature(tx.signature)"
                      class="p-0 h-auto text-white/50 hover:text-white">
                      <template #icon>
                        <CopyOutlined />
                      </template>
                </a-button>
                  </div>
                  <div class="text-xs text-white/50">{{ formatTime(tx.blockTime) }}</div>
                </div>
                <div class="flex items-center gap-2">
                <a-button
                  size="small"
                    @click.stop="viewOnExplorer(tx.signature)"
                    class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-3 py-1 text-xs font-medium rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                    <template #icon>
                      <GlobalOutlined />
            </template>
                    {{ t('transactionHistory.viewOnSolscan') }}
                  </a-button>
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else class="text-center py-12">
            <HistoryOutlined class="text-6xl text-white/30 mb-4" />
            <p class="text-white/60">{{ t('transactionHistory.empty') }}</p>
          </div>

          <!-- 分页组件 -->
          <div v-if="transactions.length > pageSize" class="mt-6 flex justify-center">
            <a-pagination
              v-model:current="currentPage"
              :total="transactions.length"
              :page-size="pageSize"
              :show-size-changer="false"
              :show-quick-jumper="true"
              :show-total="(total: number, range: [number, number]) => t('transactionHistory.paginationTotal', { total, start: range[0], end: range[1] })"
              @change="handlePageChange"
              class="[&_.ant-pagination-item]:bg-white/10 [&_.ant-pagination-item]:border-white/20 [&_.ant-pagination-item]:text-white [&_.ant-pagination-item:hover]:border-solana-green [&_.ant-pagination-item-active]:bg-solana-green [&_.ant-pagination-item-active]:border-solana-green [&_.ant-pagination-prev]:text-white [&_.ant-pagination-next]:text-white [&_.ant-pagination-jump-prev]:text-white [&_.ant-pagination-jump-next]:text-white [&_.ant-pagination-total-text]:text-white [&_.ant-pagination-options]:text-white [&_.ant-pagination-options-quick-jumper]:text-white [&_.ant-pagination-options-quick-jumper_input]:text-white" />
          </div>
        </div>
      </div>
    </div>

    <!-- 交易详情模态框 -->
    <a-modal
      v-model:open="detailModalVisible"
      :title="t('transactionHistory.detail')"
      width="58%"
      :footer="null"
      class="transaction-detail-modal"
      :wrap-class-name="'transaction-detail-modal-wrap'"
      :get-container="false"
    >
      <div v-if="selectedTransaction" class="transaction-detail-content space-y-6">
        <!-- 基本信息 -->
        <div class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border border-white/10 rounded-2xl p-6 overflow-visible transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(20,241,149,0.3)] hover:shadow-[0_8px_32px_rgba(20,241,149,0.15)]">
          <div class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          <div class="relative z-[1]">
            <div class="flex items-center justify-between mb-4">
              <h3 class="m-0 text-xl font-semibold text-white flex items-center">
                <WalletOutlined class="mr-2 text-solana-green" />
                {{ t('transactionHistory.detailBasicInfo') }}
              </h3>
              <a-button
                v-if="selectedTransaction.signature"
                @click="viewOnExplorer(selectedTransaction.signature)"
                type="text"
                class="flex items-center justify-center text-white px-0 py-0 h-auto transition-all duration-300 ease-in-out hover:text-solana-green">
                <template #icon>
                  <GlobalOutlined />
                </template>
                {{ t('transactionHistory.viewOnSolscan') }}
              </a-button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <div class="text-xs font-medium text-white/60 mb-2">{{ t('transactionHistory.detailSignature') }}</div>
                <div class="flex items-center gap-2 bg-white/5 rounded-xl p-3 border border-white/10">
                  <code class="text-sm text-white/90 font-mono break-all flex-1 min-w-0">{{ selectedTransaction.signature || 'N/A' }}</code>
                  <a-button
                    v-if="selectedTransaction.signature"
                    type="text"
                    size="small"
                    @click="copySignature(selectedTransaction.signature)"
                    class="flex items-center justify-center text-white px-2 py-1 h-auto transition-all duration-300 ease-in-out hover:text-solana-green flex-shrink-0">
                    <template #icon>
                      <CopyOutlined />
                    </template>
                    {{ t('common.copy') }}
                  </a-button>
                </div>
              </div>
              <div>
                <div class="text-xs font-medium text-white/60 mb-2">{{ t('transactionHistory.detailStatus') }}</div>
            <a-tag :color="getStatus(selectedTransaction).color">
                  <component :is="getStatus(selectedTransaction).icon" class="mr-1" />
              {{ getStatus(selectedTransaction).text }}
            </a-tag>
              </div>
              <div>
                <div class="text-xs font-medium text-white/60 mb-2">Slot</div>
                <div class="text-sm text-white/90 font-semibold">{{ selectedTransaction.slot || 'N/A' }}</div>
              </div>
              <div>
                <div class="text-xs font-medium text-white/60 mb-2">{{ t('transactionHistory.blockTime') }}</div>
                <div class="text-sm text-white/90 font-semibold">{{ formatTime(selectedTransaction.blockTime) }}</div>
              </div>
              <div>
                <div class="text-xs font-medium text-white/60 mb-2">{{ t('transactionHistory.transactionFee') }}</div>
                <div class="text-sm text-white/90 font-semibold">
                  {{ selectedTransaction.parsed?.meta?.fee ? `${(selectedTransaction.parsed.meta.fee / 1e9).toFixed(9)} ${t('transactionHistory.solUnit')}` : 'N/A' }}
                </div>
              </div>
              <div>
                <div class="text-xs font-medium text-white/60 mb-2">{{ t('transactionHistory.transactionType') }}</div>
                <div class="text-sm text-white/90 font-semibold">{{ getTransactionType(selectedTransaction) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 交易指令详情 -->
        <div v-if="selectedTransaction.parsed?.transaction?.message?.instructions && selectedTransaction.parsed.transaction.message.instructions.length > 0" class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border border-white/10 rounded-2xl p-6 overflow-visible transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(20,241,149,0.3)] hover:shadow-[0_8px_32px_rgba(20,241,149,0.15)]">
          <div class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          <div class="relative z-[1]">
            <h3 class="m-0 text-xl font-semibold text-white mb-4 flex items-center">
              <HistoryOutlined class="mr-2 text-solana-green" />
              {{ t('transactionHistory.transactionInstructions') }} ({{ selectedTransaction.parsed.transaction.message.instructions.length }})
            </h3>
            <div class="space-y-3">
              <div
                v-for="(instruction, index) in selectedTransaction.parsed.transaction.message.instructions"
                :key="index"
                class="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-[rgba(20,241,149,0.3)] transition-all duration-300">
                <div class="flex items-center gap-3 mb-3 pb-3 border-b border-white/10">
                  <span class="bg-gradient-solana text-dark-bg font-bold text-xs px-3 py-1 rounded-lg">#{{ Number(index) + 1 }}</span>
                  <span class="text-sm font-semibold text-white/90">{{ parseInstructionDetails(instruction, index, []).type || t('transactionHistory.typeUnknown') }}</span>
                  <span class="ml-auto text-xs text-solana-green bg-solana-green/10 px-3 py-1 rounded-lg border border-solana-green/20">{{ parseInstructionDetails(instruction, index, []).programName }}</span>
                </div>

                <!-- SOL 转账详情 -->
                <div v-if="parseInstructionDetails(instruction, index, []).type === t('transactionHistory.typeSolTransfer')" class="space-y-3">
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.sender') }}:</span>
                    <code class="text-xs text-solana-green font-mono bg-solana-green/10 px-3 py-1.5 rounded-lg border border-solana-green/20 flex-1 break-all">{{ parseInstructionDetails(instruction, index, []).source }}</code>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.recipient') }}:</span>
                    <code class="text-xs text-solana-green font-mono bg-solana-green/10 px-3 py-1.5 rounded-lg border border-solana-green/20 flex-1 break-all">{{ parseInstructionDetails(instruction, index, []).destination }}</code>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.amountLabel') }}:</span>
                    <span class="text-sm font-bold text-solana-green bg-solana-green/10 px-4 py-1.5 rounded-lg border border-solana-green/20">{{ parseInstructionDetails(instruction, index, []).solAmount }}</span>
                  </div>
                </div>

                <!-- 代币转账详情 -->
                <div v-else-if="parseInstructionDetails(instruction, index, []).type === t('transactionHistory.typeTokenTransfer')" class="space-y-3">
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.sender') }}:</span>
                    <code class="text-xs text-solana-green font-mono bg-solana-green/10 px-3 py-1.5 rounded-lg border border-solana-green/20 flex-1 break-all">{{ formatAddress(parseInstructionDetails(instruction, index, []).source) }}</code>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.recipient') }}:</span>
                    <code class="text-xs text-solana-green font-mono bg-solana-green/10 px-3 py-1.5 rounded-lg border border-solana-green/20 flex-1 break-all">{{ formatAddress(parseInstructionDetails(instruction, index, []).destination) }}</code>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.token') }}:</span>
                    <code class="text-xs text-solana-green font-mono bg-solana-green/10 px-3 py-1.5 rounded-lg border border-solana-green/20 flex-1 break-all">{{ formatAddress(parseInstructionDetails(instruction, index, []).mint) }}</code>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.amountLabel') }}:</span>
                    <span class="text-sm font-bold text-solana-green bg-solana-green/10 px-4 py-1.5 rounded-lg border border-solana-green/20">{{ parseInstructionDetails(instruction, index, []).tokenAmount }}</span>
                  </div>
                </div>

                <!-- 铸造代币详情 -->
                <div v-else-if="parseInstructionDetails(instruction, index, []).type === t('transactionHistory.typeMintToken')" class="space-y-3">
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.tokenAddress') }}:</span>
                    <code class="text-xs text-solana-green font-mono bg-solana-green/10 px-3 py-1.5 rounded-lg border border-solana-green/20 flex-1 break-all">{{ parseInstructionDetails(instruction, index, []).mint }}</code>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.recipient') }}:</span>
                    <code class="text-xs text-solana-green font-mono bg-solana-green/10 px-3 py-1.5 rounded-lg border border-solana-green/20 flex-1 break-all">{{ parseInstructionDetails(instruction, index, []).destination }}</code>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.authority') }}:</span>
                    <code class="text-xs text-solana-green font-mono bg-solana-green/10 px-3 py-1.5 rounded-lg border border-solana-green/20 flex-1 break-all">{{ parseInstructionDetails(instruction, index, []).authority }}</code>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.mintAmount') }}:</span>
                    <span class="text-sm font-bold text-solana-green bg-solana-green/10 px-4 py-1.5 rounded-lg border border-solana-green/20">{{ parseInstructionDetails(instruction, index, []).tokenAmount }}</span>
                  </div>
                </div>

                <!-- 销毁代币详情 -->
                <div v-else-if="parseInstructionDetails(instruction, index, []).type === t('transactionHistory.typeBurnToken')" class="space-y-3">
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.tokenAddress') }}:</span>
                    <code class="text-xs text-solana-green font-mono bg-solana-green/10 px-3 py-1.5 rounded-lg border border-solana-green/20 flex-1 break-all">{{ parseInstructionDetails(instruction, index, []).mint }}</code>
        </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.account') }}:</span>
                    <code class="text-xs text-solana-green font-mono bg-solana-green/10 px-3 py-1.5 rounded-lg border border-solana-green/20 flex-1 break-all">{{ parseInstructionDetails(instruction, index, []).account }}</code>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.authority') }}:</span>
                    <code class="text-xs text-solana-green font-mono bg-solana-green/10 px-3 py-1.5 rounded-lg border border-solana-green/20 flex-1 break-all">{{ parseInstructionDetails(instruction, index, []).authority }}</code>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-white/60 min-w-[80px]">{{ t('transactionHistory.burnAmount') }}:</span>
                    <span class="text-sm font-bold text-solana-green bg-solana-green/10 px-4 py-1.5 rounded-lg border border-solana-green/20">{{ parseInstructionDetails(instruction, index, []).tokenAmount }}</span>
                  </div>
                </div>

                <!-- 其他类型显示原始数据 -->
                <div v-else>
                  <pre class="text-xs text-white/80 font-mono bg-white/5 rounded-lg p-4 border border-white/10 overflow-auto max-h-64">{{ JSON.stringify(parseInstructionDetails(instruction, index, []).raw || instruction, null, 2) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 账户余额变更 -->
        <div v-if="getAccountChanges(selectedTransaction).length > 0" class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border border-white/10 rounded-2xl p-6 overflow-visible transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(20,241,149,0.3)] hover:shadow-[0_8px_32px_rgba(20,241,149,0.15)]">
          <div class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          <div class="relative z-[1]">
            <h3 class="m-0 text-xl font-semibold text-white mb-4 flex items-center">
              <WalletOutlined class="mr-2 text-solana-green" />
              {{ t('transactionHistory.accountBalanceChanges') }}
            </h3>
            <div class="space-y-3">
              <div
                v-for="(change, index) in getAccountChanges(selectedTransaction)"
                :key="index"
                class="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-[rgba(20,241,149,0.3)] transition-all duration-300">
                <div class="flex items-center justify-between mb-2">
                  <code class="text-xs text-white/90 font-mono bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">{{ formatAddress(change.address) }}</code>
                  <span :class="['text-sm font-bold px-4 py-1.5 rounded-lg', Number(change.change) > 0 ? 'text-solana-green bg-solana-green/10 border border-solana-green/20' : 'text-red-400 bg-red-400/10 border border-red-400/20']">
                    {{ Number(change.change) > 0 ? '+' : '' }}{{ change.change }} {{ t('transactionHistory.solUnit') }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs text-white/60">
                  <span>{{ t('transactionHistory.beforeLabel') }}: {{ change.preBalance }} {{ t('transactionHistory.solUnit') }}</span>
                  <span>→</span>
                  <span>{{ t('transactionHistory.afterLabel') }}: {{ change.postBalance }} {{ t('transactionHistory.solUnit') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 交易日志 -->
        <div v-if="getTransactionLogs(selectedTransaction).length > 0" class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border border-white/10 rounded-2xl p-6 overflow-visible transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(20,241,149,0.3)] hover:shadow-[0_8px_32px_rgba(20,241,149,0.15)]">
          <div class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          <div class="relative z-[1]">
            <h3 class="m-0 text-xl font-semibold text-white mb-4 flex items-center">
              <HistoryOutlined class="mr-2 text-solana-green" />
              {{ t('transactionHistory.transactionLogs') }} ({{ getTransactionLogs(selectedTransaction).length }})
            </h3>
            <div class="space-y-2 max-h-96 overflow-y-auto">
              <div
                v-for="(log, index) in getTransactionLogs(selectedTransaction)"
                :key="index"
                :class="['text-xs text-white/85 font-mono bg-white/5 rounded-lg p-3 border border-white/10', log.includes('Error') ? 'text-red-400 bg-red-400/10 border-red-400/20' : '']">
                {{ log }}
              </div>
            </div>
          </div>
        </div>

        <!-- 错误信息 -->
        <div v-if="selectedTransaction.err" class="relative bg-gradient-to-br from-[rgba(255,77,79,0.1)] to-[rgba(255,77,79,0.05)] border border-red-400/30 rounded-2xl p-6 overflow-visible transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px]">
          <div class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none"></div>
          <div class="relative z-[1]">
            <h3 class="m-0 text-xl font-semibold text-red-400 mb-4 flex items-center">
              <CloseCircleOutlined class="mr-2" />
              {{ t('transactionHistory.transactionError') }}
            </h3>
            <pre class="text-xs text-red-300 font-mono bg-red-500/10 rounded-lg p-4 border border-red-400/20 overflow-auto max-h-64">{{ JSON.stringify(selectedTransaction.err, null, 2) }}</pre>
          </div>
        </div>

        <!-- 完整交易数据 -->
        <div class="relative bg-gradient-to-br from-[rgba(26,34,53,0.9)] to-[rgba(11,19,43,0.9)] border border-white/10 rounded-2xl p-6 overflow-visible transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[20px] hover:border-[rgba(20,241,149,0.3)] hover:shadow-[0_8px_32px_rgba(20,241,149,0.15)]">
          <div class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          <div class="relative z-[1]">
            <h3 class="m-0 text-xl font-semibold text-white mb-4 flex items-center">
              <GlobalOutlined class="mr-2 text-solana-green" />
              {{ t('transactionHistory.fullTransactionData') }}
            </h3>
            <pre class="text-xs text-white/80 font-mono bg-white/5 rounded-lg p-4 border border-white/10 overflow-auto max-h-96">{{ JSON.stringify(selectedTransaction, null, 2) }}</pre>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-12">
        <div class="text-white/60">{{ t('transactionHistory.loading') }}</div>
      </div>
    </a-modal>
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

/* 模态框样式 */
:deep(.transaction-detail-modal-wrap) {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10px !important;
}

:deep(.transaction-detail-modal-wrap .ant-modal) {
  top: 0px !important;
  margin: 0 !important;
  padding-bottom: 10px !important;
}

:deep(.transaction-detail-modal .ant-modal) {
  top: 0px !important;
  margin: 0 !important;
  padding-bottom: 10px !important;
}

:deep(.transaction-detail-modal .ant-modal-content) {
  background: linear-gradient(to bottom right, rgba(26, 34, 53, 0.95), rgba(11, 19, 43, 0.95)) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  height: calc(100vh - 20px) !important;
  max-height: calc(100vh - 20px) !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(20px);
}

:deep(.transaction-detail-modal .ant-modal-header) {
  flex-shrink: 0;
  padding: 16px 24px !important;
}

:deep(.transaction-detail-modal .ant-modal-body) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.9) !important;
  padding: 24px !important;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

:deep(.transaction-detail-modal .ant-modal-header) {
  background: transparent !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
}

:deep(.transaction-detail-modal .ant-modal-title) {
  color: rgba(255, 255, 255, 0.9) !important;
  font-size: 20px;
  font-weight: 600;
}

:deep(.transaction-detail-modal .ant-modal-close) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.transaction-detail-modal .ant-modal-close:hover) {
  color: rgba(255, 255, 255, 1) !important;
}

/* 详情内容区域 */
.transaction-detail-content {
  color: rgba(255, 255, 255, 0.9) !important;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-section {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.detail-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom right, rgba(255, 255, 255, 0.05), transparent);
  pointer-events: none;
}

.detail-section:hover {
  border-color: rgba(20, 241, 149, 0.3);
  background: rgba(255, 255, 255, 0.08);
}

.detail-section-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  position: relative;
  z-index: 1;
}

.detail-section-title .anticon {
  color: #14f195;
}

/* 详情网格布局 */
.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item.col-span-2 {
  grid-column: span 2;
}

.detail-item label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.detail-code {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  font-family: 'Courier New', monospace;
  word-break: break-all;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  flex: 1;
}

.detail-btn {
  background: rgba(20, 241, 149, 0.1);
  border-color: rgba(20, 241, 149, 0.3);
  color: #14f195;
  font-size: 12px;
  padding: 6px 14px;
  height: auto;
  border-radius: 8px;
  transition: all 0.3s ease;
  font-weight: 500;
}

.detail-btn:hover {
  background: rgba(20, 241, 149, 0.2);
  border-color: rgba(20, 241, 149, 0.5);
  color: #14f195;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(20, 241, 149, 0.2);
}

.detail-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid;
}

.detail-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.detail-action-btn {
  background: linear-gradient(135deg, #14f195 0%, #9945ff 100%);
  border: none;
  color: #000;
  font-weight: 600;
  padding: 10px 24px;
  height: auto;
  border-radius: 10px;
  font-size: 15px;
  transition: all 0.3s ease;
}

.detail-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(20, 241, 149, 0.4);
}

/* 指令列表 */
.instructions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.instruction-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.instruction-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom right, rgba(255, 255, 255, 0.03), transparent);
  pointer-events: none;
}

.instruction-card:hover {
  border-color: rgba(20, 241, 149, 0.3);
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(20, 241, 149, 0.15);
}

.instruction-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.instruction-index {
  background: linear-gradient(135deg, #14f195 0%, #9945ff 100%);
  color: #000;
  font-weight: 700;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  min-width: 32px;
  text-align: center;
}

.instruction-type {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.instruction-program {
  font-size: 12px;
  color: rgba(20, 241, 149, 0.9);
  background: rgba(20, 241, 149, 0.1);
  padding: 4px 10px;
  border-radius: 6px;
  margin-left: auto;
}

.instruction-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.detail-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  min-width: 80px;
  font-weight: 500;
}

.detail-value-code {
  font-size: 13px;
  color: rgba(20, 241, 149, 0.9);
  font-family: 'Courier New', monospace;
  background: rgba(20, 241, 149, 0.08);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(20, 241, 149, 0.2);
  word-break: break-all;
}

.detail-value-amount {
  font-size: 15px;
  font-weight: 700;
  color: #14f195;
  background: rgba(20, 241, 149, 0.1);
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid rgba(20, 241, 149, 0.2);
}

.instruction-raw {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-family: 'Courier New', monospace;
  background: rgba(0, 0, 0, 0.2);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}

/* 账户变更列表 */
.account-changes-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.account-change-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 14px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.account-change-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom right, rgba(255, 255, 255, 0.03), transparent);
  pointer-events: none;
}

.account-change-card:hover {
  border-color: rgba(20, 241, 149, 0.3);
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(20, 241, 149, 0.15);
}

.account-change-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.account-address {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  font-family: 'Courier New', monospace;
  background: rgba(255, 255, 255, 0.05);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.account-change-amount {
  font-size: 16px;
  font-weight: 700;
  padding: 6px 16px;
  border-radius: 6px;
}

.account-change-amount.positive {
  color: #14f195;
  background: rgba(20, 241, 149, 0.1);
  border: 1px solid rgba(20, 241, 149, 0.2);
}

.account-change-amount.negative {
  color: #ff4d4f;
  background: rgba(255, 77, 79, 0.1);
  border: 1px solid rgba(255, 77, 79, 0.2);
}

.account-change-details {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.change-separator {
  color: rgba(255, 255, 255, 0.4);
}

/* 交易日志 */
.logs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.log-item {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  font-family: 'Courier New', monospace;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 14px;
  border-radius: 8px;
  border-left: 3px solid rgba(20, 241, 149, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 3px solid rgba(20, 241, 149, 0.5);
  word-break: break-all;
  line-height: 1.6;
  transition: all 0.3s ease;
}

.log-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-left-color: rgba(20, 241, 149, 0.8);
}

.log-item.error {
  border-left-color: #ff4d4f;
  color: #ff7875;
  background: rgba(255, 77, 79, 0.1);
  border-color: rgba(255, 77, 79, 0.2);
}

.log-item.error:hover {
  background: rgba(255, 77, 79, 0.15);
}

/* 错误区域 */
.error-section {
  background: rgba(255, 77, 79, 0.1) !important;
  border-color: rgba(255, 77, 79, 0.3) !important;
}

.error-section::before {
  background: linear-gradient(to bottom right, rgba(255, 77, 79, 0.05), transparent) !important;
}

.error-details {
  font-size: 12px;
  color: #ff7875;
  font-family: 'Courier New', monospace;
  background: rgba(255, 77, 79, 0.05);
  padding: 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 77, 79, 0.2);
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
  line-height: 1.6;
}

/* 原始数据 */
.raw-data {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  font-family: 'Courier New', monospace;
  background: rgba(255, 255, 255, 0.05);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
  line-height: 1.5;
}

/* 标签样式 */
:deep(.ant-tag) {
  background-color: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-tag-success) {
  background-color: rgba(82, 196, 26, 0.2) !important;
  border-color: rgba(82, 196, 26, 0.3) !important;
  color: #52c41a !important;
}

:deep(.ant-tag-error) {
  background-color: rgba(255, 77, 79, 0.2) !important;
  border-color: rgba(255, 77, 79, 0.3) !important;
  color: #ff4d4f !important;
}

:deep(.ant-tag-processing) {
  background-color: rgba(24, 144, 255, 0.2) !important;
  border-color: rgba(24, 144, 255, 0.3) !important;
  color: #1890ff !important;
}

/* 分页组件文字颜色 */
:deep(.ant-pagination) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-pagination-item) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-pagination-item a) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-pagination-prev),
:deep(.ant-pagination-next),
:deep(.ant-pagination-jump-prev),
:deep(.ant-pagination-jump-next) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-pagination-prev a),
:deep(.ant-pagination-next a),
:deep(.ant-pagination-jump-prev a),
:deep(.ant-pagination-jump-next a) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-pagination-prev .anticon),
:deep(.ant-pagination-next .anticon),
:deep(.ant-pagination-jump-prev .anticon),
:deep(.ant-pagination-jump-next .anticon) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-pagination-prev:hover .anticon),
:deep(.ant-pagination-next:hover .anticon),
:deep(.ant-pagination-jump-prev:hover .anticon),
:deep(.ant-pagination-jump-next:hover .anticon) {
  color: rgba(255, 255, 255, 1) !important;
}

:deep(.ant-pagination-total-text) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-pagination-options) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-pagination-options-quick-jumper) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-pagination-options-quick-jumper input) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.ant-pagination-options-quick-jumper input::placeholder) {
  color: rgba(255, 255, 255, 0.4) !important;
}

:deep(.ant-pagination-options-quick-jumper input:focus) {
  border-color: #14f195 !important;
  box-shadow: 0 0 0 2px rgba(20, 241, 149, 0.2) !important;
}

/* 滚动条样式 */
:deep(.transaction-detail-modal .ant-modal-body)::-webkit-scrollbar,
.logs-list::-webkit-scrollbar,
.raw-data::-webkit-scrollbar,
.error-details::-webkit-scrollbar,
.instruction-raw::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

:deep(.transaction-detail-modal .ant-modal-body)::-webkit-scrollbar-track,
.logs-list::-webkit-scrollbar-track,
.raw-data::-webkit-scrollbar-track,
.error-details::-webkit-scrollbar-track,
.instruction-raw::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

:deep(.transaction-detail-modal .ant-modal-body)::-webkit-scrollbar-thumb,
.logs-list::-webkit-scrollbar-thumb,
.raw-data::-webkit-scrollbar-thumb,
.error-details::-webkit-scrollbar-thumb,
.instruction-raw::-webkit-scrollbar-thumb {
  background: rgba(20, 241, 149, 0.3);
  border-radius: 4px;
}

:deep(.transaction-detail-modal .ant-modal-body)::-webkit-scrollbar-thumb:hover,
.logs-list::-webkit-scrollbar-thumb:hover,
.raw-data::-webkit-scrollbar-thumb:hover,
.error-details::-webkit-scrollbar-thumb:hover,
.instruction-raw::-webkit-scrollbar-thumb:hover {
  background: rgba(20, 241, 149, 0.5);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-item.col-span-2 {
    grid-column: span 1;
  }

  .instruction-header {
    flex-wrap: wrap;
  }

  .account-change-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .detail-actions {
    flex-direction: column;
  }

  .detail-action-btn {
    width: 100%;
  }
}

</style>

<style>
/* 全局样式 - 确保模态框位置和高度生效 */
.transaction-detail-modal-wrap .ant-modal {
  top: 0px !important;
  margin: 0 !important;
  padding-bottom: 10px !important;
}

.transaction-detail-modal-wrap .ant-modal-content {
  height: calc(100vh - 20px) !important;
  max-height: calc(100vh - 20px) !important;
}
</style>
