<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message } from "ant-design-vue";
import { 
  connected,
  walletBalance,
  updateBalance,
} from "../../utils/wallet";

// 刷新余额
const refreshBalance = async () => {
  if (!connected.value) {
    message.error("请先连接钱包");
    return;
  }

  try {
    await updateBalance();
    message.success("余额已更新");
  } catch (error) {
    message.error("获取余额失败");
    console.error(error);
  }
};

// 发送SOL代币
const receiverAddress = ref("");
const sendAmount = ref<number | null>(null);

const sendSol = async () => {
  if (!connected.value) {
    message.error("请先连接钱包");
    return;
  }

  if (!receiverAddress.value) {
    message.error("请输入接收地址");
    return;
  }

  if (!sendAmount.value || sendAmount.value <= 0) {
    message.error("请输入有效的发送数量");
    return;
  }

  // 在此实现发送SOL的逻辑
  message.info("发送功能尚未实现");
};

// 转账和铸币操作
const transferToken = (token: any) => {
  message.info(`准备转账 ${token.name || "未命名代币"}`);
};

const mintToken = (token: any) => {
  message.info(`准备铸币 ${token.name || "未命名代币"}`);
};

// 模拟代币数据
const tokens = [
  {
    id: 1,
    name: "aa",
    symbol: "AA",
    balance: 96,
    mint: "6LUN...1Rte",
    ata: "7513...639u",
  },
  {
    id: 2,
    name: "未命名代币",
    symbol: "",
    balance: 100,
    mint: "7zsF...HADw",
    ata: "QVbx...AClF",
  },
  {
    id: 3,
    name: "Zorro",
    symbol: "ZORRO",
    balance: 565,
    mint: "F2Vq...WvDV",
    ata: "3jnD...24rU",
  },
  {
    id: 4,
    name: "未命名代币",
    symbol: "",
    balance: 102.5,
    mint: "C5rs...2kDE",
    ata: "Emnv...3Xb5",
  },
];

// 当前选中的标签页
const selectedTabs = ref<{ [key: number]: string }>({
  1: "info",
  2: "info",
  3: "info",
  4: "info",
});

// 切换标签页
const changeTab = (tokenId: number, tab: string) => {
  selectedTabs.value[tokenId] = tab;
}; 
// 默认导出
defineOptions({
  name: "TokenList",
});
</script>

<template>
  <div class="token-list-container">
    <div class="page-header">
      <div class="page-title">
        <h2>代币列表</h2>
      </div>
      <div class="actions">
        <a-button type="primary" @click="refreshBalance">刷新余额</a-button>
      </div>
    </div>

    <a-card class="sol-balance-card">
      <div class="sol-balance-header">
        <h3>SOL余额: {{ walletBalance }} SOL</h3> 
      </div>
    </a-card>

    <div class="token-cards">
      <a-row :gutter="[16, 16]">
        <a-col
          :xs="24"
          :sm="24"
          :md="12"
          :lg="12"
          :xl="8"
          v-for="token in tokens"
          :key="token.id"
        >
          <a-card class="token-card" :bordered="false">
            <template #title>
              <div class="token-title">
                {{ token.name }} {{ token.symbol ? `(${token.symbol})` : "" }}
              </div>
            </template>
            <template #extra>
              <span class="token-balance">{{ token.balance }}</span>
            </template>

            <div class="token-actions">
              <a-button type="primary" @click="transferToken(token)"
                >转账</a-button
              >
              <a-button type="success" @click="mintToken(token)">铸币</a-button>
            </div>

            <a-divider style="margin: 12px 0" />

            <div class="token-tabs">
              <a-radio-group
                v-model:value="selectedTabs[token.id]"
                size="small"
                button-style="solid"
                class="token-radio-group"
              >
                <a-radio-button value="info">铸币位置</a-radio-button>
                <a-radio-button value="freeze">冻结位置</a-radio-button>
                <a-radio-button value="metadata">修改元数据</a-radio-button>
              </a-radio-group>
            </div>

            <div class="token-addresses">
              <p class="address-item">
                <span class="address-label">Mint:</span>
                <span class="address-value">{{ token.mint }}</span>
              </p>
              <p class="address-item">
                <span class="address-label">ATA:</span>
                <span class="address-value">{{ token.ata }}</span>
              </p>
            </div>
          </a-card>
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<style scoped>
.token-list-container {
  width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.page-title h2 {
  margin: 0;
  font-size: 20px;
  color: rgba(0, 0, 0, 0.85);
}

.sol-balance-card {
  margin-bottom: 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.sol-balance-header {
  margin-bottom: 16px;
}

.sol-balance-header h3 {
  margin: 0;
  font-size: 18px;
  color: rgba(0, 0, 0, 0.85);
}

.send-sol {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.send-sol > * {
  flex: 1;
  min-width: 100px;
}

.send-sol > a-button {
  flex: 0 0 auto;
}

.token-cards {
  margin-top: 24px;
}

.token-card {
  height: 100%;
  transition: all 0.3s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.token-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.token-title {
  font-size: 16px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.85);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.token-balance {
  font-size: 16px;
  font-weight: 500;
  color: #1890ff;
}

.token-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.token-actions > button {
  flex: 1;
}

.token-tabs {
  margin: 16px 0;
  overflow-x: auto;
}

.token-radio-group {
  display: flex;
  flex-wrap: nowrap;
  min-width: 100%;
}

.token-addresses {
  margin-top: 16px;
  font-size: 0.85rem;
}

.address-item {
  margin: 6px 0;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.address-label {
  color: rgba(0, 0, 0, 0.45);
  min-width: 45px;
}

.address-value {
  color: rgba(0, 0, 0, 0.65);
  font-family: monospace;
  word-break: break-all;
}

/* 移动端适配 */
@media (max-width: 576px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .send-sol {
    flex-direction: column;
    align-items: stretch;
  }

  .send-sol > * {
    width: 100% !important;
  }

  .token-actions {
    flex-direction: column;
  }

  .token-radio-group {
    overflow-x: auto;
    padding-bottom: 4px;
  }

  :deep(.ant-radio-button-wrapper) {
    padding: 0 10px;
  }
}
</style>
