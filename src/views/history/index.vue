<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { message } from 'ant-design-vue';
import { PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';
import { walletPublicKey, connected } from '../../utils/wallet';
import { connection } from '../../utils/wallet';

// 交易历史数据
const transactions = ref<any[]>([]);
const loading = ref(false);
const currentSignature = ref('');

// 签名详情
const selectedTransaction = ref<any>(null);
const detailModalVisible = ref(false);

// 获取交易历史
const fetchTransactionHistory = async () => {
  if (!connected.value || !walletPublicKey.value) {
    message.error('请先连接钱包');
    return;
  }

  loading.value = true;

  try {
    const signatures = await connection.getSignaturesForAddress(
      walletPublicKey.value,
      { limit: 20 }
    );

    const transactionDetails = await Promise.all(
      signatures.map(async (sig) => {
        try {
          const tx = await connection.getParsedTransaction(sig.signature);
          return {
            signature: sig.signature,
            slot: sig.slot,
            blockTime: sig.blockTime,
            confirmationStatus: sig.confirmationStatus,
            err: sig.err,
            parsed: tx
          };
        } catch (error) {
          return null;
        }
      })
    );

    // 过滤掉失败的请求
    transactions.value = transactionDetails.filter(tx => tx !== null);
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
    const tx = await connection.getParsedTransaction(signature, 'confirmed');
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
  const isDevnet = connection.rpcEndpoint.includes('devnet');
  const explorerUrl = isDevnet
    ? `https://solscan.io/tx/${signature}?cluster=devnet`
    : `https://solscan.io/tx/${signature}`;
  window.open(explorerUrl, '_blank');
};

// 格式化时间
const formatTime = (timestamp: number | null) => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString('zh-CN');
};

// 获取交易状态
const getStatus = (tx: any) => {
  if (tx.err) {
    return { text: '失败', color: 'error' };
  }
  if (tx.confirmationStatus === 'finalized') {
    return { text: '已确认', color: 'success' };
  }
  if (tx.confirmationStatus === 'confirmed') {
    return { text: '已确认', color: 'processing' };
  }
  return { text: '处理中', color: 'default' };
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
        return firstInstruction.parsed.type;
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

// 组件挂载时加载交易历史
onMounted(() => {
  if (connected.value && walletPublicKey.value) {
    fetchTransactionHistory();
  }
});

// 默认导出
defineOptions({
  name: 'TransactionHistory'
});
</script>

<template>
  <div class="history-container">
    <div class="page-header">
      <h2>交易历史</h2>
      <a-button
        type="primary"
        :loading="loading"
        @click="fetchTransactionHistory"
        :disabled="!connected"
      >
        <template #icon>
          <ReloadOutlined />
        </template>
        刷新记录
      </a-button>
    </div>

    <div v-if="!connected" class="connect-warning">
      <a-alert
        type="warning"
        show-icon
        message="请先连接钱包"
        description="连接钱包后可以查看您的交易历史记录"
      />
    </div>

    <div v-else class="history-content">
      <!-- 交易统计 -->
      <div class="stats-section">
        <a-row :gutter="16">
          <a-col :xs="24" :sm="12" :md="6">
            <a-card>
              <a-statistic
                title="总交易数"
                :value="transactions.length"
                prefix="📊"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-card>
              <a-statistic
                title="成功交易"
                :value="transactions.filter(t => !t.err).length"
                prefix="✅"
                :value-style="{ color: '#3f8600' }"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-card>
              <a-statistic
                title="失败交易"
                :value="transactions.filter(t => t.err).length"
                prefix="❌"
                :value-style="{ color: '#cf1322' }"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-card>
              <a-statistic
                title="最新交易"
                :value="transactions.length > 0 ? formatTime(transactions[0].blockTime) : 'N/A'"
                prefix="🕐"
              />
            </a-card>
          </a-col>
        </a-row>
      </div>

      <!-- 交易列表 -->
      <div class="transactions-table">
        <a-table
          :columns="[
            {
              title: '签名',
              dataIndex: 'signature',
              key: 'signature',
              width: '30%',
            },
            {
              title: '类型',
              dataIndex: 'type',
              key: 'type',
              width: '15%',
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: '15%',
            },
            {
              title: '时间',
              dataIndex: 'time',
              key: 'time',
              width: '20%',
            },
            {
              title: '操作',
              key: 'action',
              width: '20%',
            },
          ]"
          :data-source="transactions"
          :loading="loading"
          :pagination="{ pageSize: 10 }"
          row-key="signature"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'signature'">
              <div class="signature-cell">
                <code class="signature-text">
                  {{ record.signature.slice(0, 8) }}...{{ record.signature.slice(-8) }}
                </code>
              </div>
            </template>

            <template v-else-if="column.key === 'type'">
              <a-tag>{{ getTransactionType(record) }}</a-tag>
            </template>

            <template v-else-if="column.key === 'status'">
              <a-tag :color="getStatus(record).color">
                {{ getStatus(record).text }}
              </a-tag>
            </template>

            <template v-else-if="column.key === 'time'">
              <small>{{ formatTime(record.blockTime) }}</small>
            </template>

            <template v-else-if="column.key === 'action'">
              <a-space>
                <a-button
                  type="link"
                  size="small"
                  @click="viewTransactionDetail(record.signature)"
                >
                  详情
                </a-button>
                <a-button
                  type="link"
                  size="small"
                  @click="copySignature(record.signature)"
                >
                  复制
                </a-button>
                <a-button
                  type="link"
                  size="small"
                  @click="viewOnExplorer(record.signature)"
                >
                  Explorer
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <!-- 交易详情模态框 -->
    <a-modal
      v-model:open="detailModalVisible"
      title="交易详情"
      width="80%"
      :footer="null"
    >
      <div v-if="selectedTransaction" class="transaction-detail">
        <a-descriptions bordered :column="1">
          <a-descriptions-item label="签名">
            <div class="detail-row">
              <code class="detail-text">{{ selectedTransaction.signature }}</code>
              <a-button size="small" @click="copySignature(selectedTransaction.signature)">
                复制
              </a-button>
            </div>
          </a-descriptions-item>

          <a-descriptions-item label="状态">
            <a-tag :color="getStatus(selectedTransaction).color">
              {{ getStatus(selectedTransaction).text }}
            </a-tag>
          </a-descriptions-item>

          <a-descriptions-item label="Slot">
            {{ selectedTransaction.slot }}
          </a-descriptions-item>

          <a-descriptions-item label="时间">
            {{ formatTime(selectedTransaction.blockTime) }}
          </a-descriptions-item>

          <a-descriptions-item label="费用">
            {{ selectedTransaction.meta?.fee ? `${selectedTransaction.meta.fee / 1e9} SOL` : 'N/A' }}
          </a-descriptions-item>

          <a-descriptions-item label="交易类型">
            {{ getTransactionType(selectedTransaction) }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="json-viewer">
          <h3>完整交易数据</h3>
          <pre class="json-content">{{ JSON.stringify(selectedTransaction, null, 2) }}</pre>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script lang="ts">
import { ReloadOutlined } from '@ant-design/icons-vue';

export default {
  components: {
    ReloadOutlined
  }
};
</script>

<style scoped>
.history-container {
  padding: 20px;
  background: #fff;
  border-radius: 4px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: rgba(0, 0, 0, 0.85);
}

.connect-warning {
  margin-top: 20px;
}

.stats-section {
  margin-bottom: 24px;
}

.transactions-table {
  margin-top: 24px;
}

.signature-cell {
  display: flex;
  align-items: center;
}

.signature-text {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.detail-text {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  flex: 1;
}

.json-viewer {
  margin-top: 24px;
}

.json-viewer h3 {
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 500;
}

.json-content {
  background-color: rgba(0, 0, 0, 0.02);
  padding: 12px;
  border-radius: 4px;
  overflow: auto;
  max-height: 400px;
  font-size: 12px;
  line-height: 1.5;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .stats-section .ant-col {
    margin-bottom: 12px;
  }

  :deep(.ant-table) {
    font-size: 12px;
  }

  .signature-text {
    font-size: 10px;
  }
}
</style>
