<script setup lang="ts">
import {computed, onBeforeMount, reactive, ref} from 'vue';
import {Transaction} from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import {getTransactions} from '@renderer/services/transactionService';

import {
  getTransactionDate,
  getTransactionStatus,
  getTransactionId,
  getPayerFromTransaction,
  getStatusFromCode,
  openTransactionInHashscan,
} from '@renderer/utils/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const transactions = ref<Transaction[]>([]);
const sort = reactive<{field: string; direction: 'asc' | 'desc'}>({
  field: 'timestamp',
  direction: 'desc',
});
const isLoading = ref(true);

/* Computed */
const generatedClass = computed(() => {
  return sort.direction === 'desc' ? 'bi-arrow-down-short' : 'bi-arrow-up-short';
});

/* Handlers */
// TODO to be refactored
const handleSort = (field: string, direction: 'asc' | 'desc') => {
  sort.field = field;
  sort.direction = direction;

  switch (field) {
    case 'type':
      transactions.value = transactions.value.sort((t1, t2) => {
        if (direction === 'asc') {
          return t1.type.localeCompare(t2.type);
        } else if (direction === 'desc') {
          return t2.type.localeCompare(t1.type);
        } else return 0;
      });
      break;
    case 'status':
      transactions.value = transactions.value.sort((t1, t2) => {
        const status1 = getStatusFromCode(t1);
        const status2 = getStatusFromCode(t2);

        if (direction === 'asc') {
          return status1.localeCompare(status2);
        } else if (direction === 'desc') {
          return status2.localeCompare(status1);
        } else return 0;
      });
      break;
    case 'timestamp':
      transactions.value = transactions.value.sort((t1, t2) => {
        if (direction === 'asc') {
          return t1.executed_at - t2.executed_at;
        } else if (direction === 'desc') {
          return t2.executed_at - t1.executed_at;
        } else return 0;
      });
      break;
    case 'payerId':
      transactions.value = transactions.value.sort((t1, t2) => {
        const payerId1 = getPayerFromTransaction(t1);
        const payerId2 = getPayerFromTransaction(t2);

        if (direction === 'asc') {
          return payerId1 - payerId2;
        } else if (direction === 'desc') {
          return payerId2 - payerId1;
        } else return 0;
      });
      break;
    default:
      break;
  }
};

const handleTransactionDetailsClick = (transaction: Transaction) => {
  openTransactionInHashscan(transaction.transaction_id, network.network);
};

/* Functions */
const getOpositeDirection = () => (sort.direction === 'asc' ? 'desc' : 'asc');

/* Hooks */
onBeforeMount(async () => {
  try {
    transactions.value = await getTransactions(user.data.id);
    handleSort('timestamp', 'desc');
    transactions.value = transactions.value.sort((t1, t2) => t2.executed_at - t1.executed_at);
  } catch (error) {
    throw new Error((error as any).message);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <template v-if="isLoading">
    <AppLoader />
  </template>
  <table
    v-else
    class="table-custom"
  >
    <thead>
      <tr>
        <th class="w-10 text-end">#</th>
        <th>
          <div
            class="table-sort-link"
            @click="handleSort('type', sort.field === 'type' ? getOpositeDirection() : 'asc')"
          >
            <span>Transaction Type</span>
            <i
              v-if="sort.field === 'type'"
              class="bi text-title"
              :class="[generatedClass]"
            ></i>
          </div>
        </th>
        <th>
          <div
            class="table-sort-link"
            @click="handleSort('status', sort.field === 'status' ? getOpositeDirection() : 'asc')"
          >
            <span>Status</span>
            <i
              v-if="sort.field === 'status'"
              class="bi text-title"
              :class="[generatedClass]"
            ></i>
          </div>
        </th>
        <th>
          <div
            class="table-sort-link"
            @click="handleSort('payerId', sort.field === 'payerId' ? getOpositeDirection() : 'asc')"
          >
            <span>Payer ID</span>
            <i
              v-if="sort.field === 'payerId'"
              class="bi text-title"
              :class="[generatedClass]"
            ></i>
          </div>
        </th>
        <th>
          <div
            class="table-sort-link"
            @click="
              handleSort('timestamp', sort.field === 'timestamp' ? getOpositeDirection() : 'asc')
            "
          >
            <span>Timestamp</span>
            <i
              v-if="sort.field === 'timestamp'"
              class="bi text-title"
              :class="[generatedClass]"
            ></i>
          </div>
        </th>
        <th class="text-center">
          <span>Actions</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <template
        v-for="(transaction, i) in transactions"
        :key="i"
      >
        <tr>
          <td>{{ i + 1 }}</td>
          <td>
            <span class="text-bold">{{ transaction.type }}</span>
          </td>
          <td>
            <span
              class="badge bg-success text-break"
              :class="{'bg-danger': ![0, 22].includes(transaction.status_code)}"
              >{{ getTransactionStatus(transaction) }}</span
            >
          </td>
          <td>
            <span class="text-secondary">{{ getTransactionId(transaction) }}</span>
          </td>
          <td>
            <span class="text-secondary">
              {{ getTransactionDate(transaction) }}
            </span>
          </td>
          <td class="text-center">
            <AppButton
              @click="handleTransactionDetailsClick(transaction)"
              color="primary"
              >Details</AppButton
            >
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>
