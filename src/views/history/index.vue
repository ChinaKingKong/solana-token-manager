<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '../../hooks/useWallet';
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
    message.error('请先连接钱包');
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
    message.success(`成功加载 ${transactions.value.length} 条交易记录`);
  } catch (error) {
    message.error('获取交易历史失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

// 查看交易详情
const viewTransactionDetail = async (signature: string) => {
  currentSignature.value = signature;
  loading.value = true;

  try {
    const conn = connection.value;
    const tx = await conn.getParsedTransaction(signature, 'confirmed');
    selectedTransaction.value = {
      signature,
      ...tx
    };
    detailModalVisible.value = true;
  } catch (error) {
    message.error('获取交易详情失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

// 复制签名到剪贴板
const copySignature = (signature: string) => {
  navigator.clipboard.writeText(signature)
    .then(() => {
      message.success('已复制签名到剪贴板');
    })
    .catch(() => {
      message.error('复制失败');
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
    return { text: '失败', color: 'error', icon: CloseCircleOutlined };
  }
  if (tx.confirmationStatus === 'finalized') {
    return { text: '已确认', color: 'success', icon: CheckCircleOutlined };
  }
  if (tx.confirmationStatus === 'confirmed') {
    return { text: '已确认', color: 'processing', icon: CheckCircleOutlined };
  }
  return { text: '处理中', color: 'default', icon: ClockCircleOutlined };
};

// 获取交易类型
const getTransactionType = (tx: any) => {
  if (!tx.parsed || !tx.parsed.transaction || !tx.parsed.transaction.message) {
    return '未知';
  }

  const instructions = tx.parsed.transaction.message.instructions;
  if (!instructions || instructions.length === 0) {
    return 'SOL转账';
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
          'transfer': '代币转账',
          'transferChecked': '代币转账',
          'mintTo': '铸造代币',
          'mintToChecked': '铸造代币',
          'burn': '销毁代币',
          'burnChecked': '销毁代币',
          'freezeAccount': '冻结账户',
          'thawAccount': '解冻账户',
        };
        return typeMap[type] || '代币操作';
      }
      return '代币操作';
    }

    // System Program
    if (programId.includes('System')) {
      return 'SOL转账';
    }
  }

  return '其他';
};

// 格式化地址
const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
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
        <h3 class="text-2xl font-bold text-white mb-2">请先连接钱包</h3>
        <p class="text-white/60">连接钱包后即可查看交易历史记录</p>
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
            <h2 class="m-0 text-2xl font-semibold text-white">交易历史</h2>
            <a-button
              type="primary"
              :loading="loading"
              @click="fetchTransactionHistory"
              class="flex items-center justify-center bg-gradient-solana border-none text-dark-bg font-semibold px-6 py-2.5 h-auto text-[15px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(20,241,149,0.4)] transition-all duration-300">
              <template #icon>
                <ReloadOutlined />
              </template>
              刷新记录
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
                  <div class="text-xs font-medium text-white/60 mb-1">总交易数</div>
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
                  <div class="text-xs font-medium text-white/60 mb-1">成功交易</div>
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
                  <div class="text-xs font-medium text-white/60 mb-1">失败交易</div>
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
                  <div class="text-xs font-medium text-white/60 mb-1">最新交易</div>
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
                  <div class="flex items-center gap-3 mb-2">
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
                    Solscan
                  </a-button>
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else class="text-center py-12">
            <HistoryOutlined class="text-6xl text-white/30 mb-4" />
            <p class="text-white/60">暂无交易记录</p>
          </div>

          <!-- 分页组件 -->
          <div v-if="transactions.length > pageSize" class="mt-6 flex justify-center">
            <a-pagination
              v-model:current="currentPage"
              :total="transactions.length"
              :page-size="pageSize"
              :show-size-changer="false"
              :show-quick-jumper="true"
              :show-total="(total: number, range: [number, number]) => `共 ${total} 条交易，第 ${range[0]}-${range[1]} 条`"
              @change="handlePageChange"
              class="[&_.ant-pagination-item]:bg-white/10 [&_.ant-pagination-item]:border-white/20 [&_.ant-pagination-item]:text-white [&_.ant-pagination-item:hover]:border-solana-green [&_.ant-pagination-item-active]:bg-solana-green [&_.ant-pagination-item-active]:border-solana-green [&_.ant-pagination-prev]:text-white [&_.ant-pagination-next]:text-white [&_.ant-pagination-jump-prev]:text-white [&_.ant-pagination-jump-next]:text-white [&_.ant-pagination-total-text]:text-white [&_.ant-pagination-options]:text-white [&_.ant-pagination-options-quick-jumper]:text-white [&_.ant-pagination-options-quick-jumper_input]:text-white" />
          </div>
        </div>
      </div>
    </div>

    <!-- 交易详情模态框 -->
    <a-modal
      v-model:open="detailModalVisible"
      title="交易详情"
      width="90%"
      :footer="null"
      class="transaction-detail-modal"
    >
      <div v-if="selectedTransaction" class="space-y-4">
        <div class="bg-white/5 rounded-xl p-4 border border-white/10">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div class="text-xs font-medium text-white/60 mb-1">签名</div>
              <div class="flex items-center gap-2">
                <code class="text-sm text-white/90 font-mono break-all flex-1">{{ selectedTransaction.signature }}</code>
                <a-button
                  size="small"
                  @click="copySignature(selectedTransaction.signature)"
                  class="flex items-center justify-center bg-white/10 border border-white/20 text-white px-3 py-1 text-xs font-medium rounded-lg transition-all duration-300 ease-in-out hover:bg-white/15 hover:border-white/30">
                  <template #icon>
                    <CopyOutlined />
                  </template>
                  复制
                </a-button>
              </div>
            </div>
            <div>
              <div class="text-xs font-medium text-white/60 mb-1">状态</div>
              <a-tag :color="getStatus(selectedTransaction).color">
                {{ getStatus(selectedTransaction).text }}
              </a-tag>
            </div>
            <div>
              <div class="text-xs font-medium text-white/60 mb-1">Slot</div>
              <div class="text-sm text-white/90">{{ selectedTransaction.slot }}</div>
            </div>
            <div>
              <div class="text-xs font-medium text-white/60 mb-1">时间</div>
              <div class="text-sm text-white/90">{{ formatTime(selectedTransaction.blockTime) }}</div>
            </div>
            <div>
              <div class="text-xs font-medium text-white/60 mb-1">费用</div>
              <div class="text-sm text-white/90">
                {{ selectedTransaction.meta?.fee ? `${selectedTransaction.meta.fee / 1e9} SOL` : 'N/A' }}
              </div>
            </div>
            <div>
              <div class="text-xs font-medium text-white/60 mb-1">交易类型</div>
              <div class="text-sm text-white/90">{{ getTransactionType(selectedTransaction) }}</div>
            </div>
          </div>
        </div>

        <div class="bg-white/5 rounded-xl p-4 border border-white/10">
          <h3 class="m-0 text-base font-semibold text-white mb-4">完整交易数据</h3>
          <pre class="text-xs text-white/80 font-mono bg-white/5 rounded-lg p-4 border border-white/10 overflow-auto max-h-96">{{ JSON.stringify(selectedTransaction, null, 2) }}</pre>
        </div>
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
:deep(.transaction-detail-modal .ant-modal-content) {
  background: linear-gradient(to bottom right, rgba(26, 34, 53, 0.95), rgba(11, 19, 43, 0.95)) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

:deep(.transaction-detail-modal .ant-modal-header) {
  background: transparent !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
}

:deep(.transaction-detail-modal .ant-modal-title) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.transaction-detail-modal .ant-modal-close) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.transaction-detail-modal .ant-modal-close:hover) {
  color: rgba(255, 255, 255, 1) !important;
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
</style>
