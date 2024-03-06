<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref } from 'vue';
import { Prisma, Transaction } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getTransactions } from '@renderer/services/transactionService';

import {
  getTransactionDate,
  getTransactionStatus,
  getTransactionId,
  openTransactionInHashscan,
  getStatusFromCode,
  getTransactionValidStart,
} from '@renderer/utils/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const transactions = ref<Transaction[]>([]);
const sort = reactive<{ field: Prisma.TransactionScalarFieldEnum; direction: Prisma.SortOrder }>({
  field: 'created_at',
  direction: 'desc',
});
const page = ref(0);
const pageSize = ref(10);
const isLoading = ref(true);

/* Computed */
const generatedClass = computed(() => {
  return sort.direction === 'desc' ? 'bi-arrow-down-short' : 'bi-arrow-up-short';
});

/* Handlers */
// TODO to be refactored
const handleSort = (field: Prisma.TransactionScalarFieldEnum, direction: Prisma.SortOrder) => {
  sort.field = field;
  sort.direction = direction;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let sortCallback = (_t1: Transaction, _t2: Transaction) => 0;

  switch (field) {
    case 'type':
      sortCallback = (t1, t2) => {
        if (direction === 'asc') {
          return t1.type.localeCompare(t2.type);
        } else if (direction === 'desc') {
          return t2.type.localeCompare(t1.type);
        } else return 0;
      };
      break;
    case 'status_code':
      sortCallback = (t1, t2) => {
        const status1 = getStatusFromCode(t1.status_code);
        const status2 = getStatusFromCode(t2.status_code);

        if (direction === 'asc') {
          return status1.localeCompare(status2);
        } else if (direction === 'desc') {
          return status2.localeCompare(status1);
        } else return 0;
      };
      break;
    case 'created_at':
      sortCallback = (t1, t2) => {
        if (direction === 'asc') {
          return t1.created_at.getTime() - t2.created_at.getTime();
        } else if (direction === 'desc') {
          return t2.created_at.getTime() - t1.created_at.getTime();
        } else return 0;
      };
      break;
    case 'transaction_id':
      sortCallback = (t1, t2) => {
        const validStart1 = getTransactionValidStart(t1)?.seconds;
        const validStart2 = getTransactionValidStart(t2)?.seconds;

        if (direction === 'asc') {
          return validStart1 - validStart2;
        } else if (direction === 'desc') {
          return validStart2 - validStart1;
        } else return 0;
      };
      break;
    default:
      break;
  }

  transactions.value = transactions.value.sort(sortCallback);
};

const handleLoadMore = async () => {
  page.value += 1;
  const nextPage = await getTransactions(createFindArgs());
  transactions.value = transactions.value.concat(nextPage);
  handleSort(sort.field, sort.direction);
};

const handleTransactionDetailsClick = (transaction: Transaction) => {
  openTransactionInHashscan(transaction.transaction_id, network.network);
};

/* Functions */
function getOpositeDirection() {
  return sort.direction === 'asc' ? 'desc' : 'asc';
}

function createFindArgs(): Prisma.TransactionFindManyArgs {
  return {
    where: {
      user_id: user.data.id,
    },
    // orderBy: {
    //   [sort.field]: sort.direction,
    // },
    skip: page.value * pageSize.value,
    take: pageSize.value,
  };
}

/* Hooks */
onBeforeMount(async () => {
  try {
    transactions.value = await getTransactions(createFindArgs());
    handleSort(sort.field, sort.direction);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <template v-if="isLoading">
    <AppLoader />
  </template>
  <table v-else class="table-custom">
    <thead>
      <tr>
        <th>
          <div
            class="table-sort-link"
            @click="
              handleSort(
                'transaction_id',
                sort.field === 'transaction_id' ? getOpositeDirection() : 'asc',
              )
            "
          >
            <span>Transaction ID</span>
            <i
              v-if="sort.field === 'transaction_id'"
              class="bi text-title"
              :class="[generatedClass]"
            ></i>
          </div>
        </th>
        <th>
          <div
            class="table-sort-link"
            @click="handleSort('type', sort.field === 'type' ? getOpositeDirection() : 'asc')"
          >
            <span>Transaction Type</span>
            <i v-if="sort.field === 'type'" class="bi text-title" :class="[generatedClass]"></i>
          </div>
        </th>
        <th>
          <div
            class="table-sort-link"
            @click="
              handleSort(
                'status_code',
                sort.field === 'status_code' ? getOpositeDirection() : 'asc',
              )
            "
          >
            <span>Status</span>
            <i
              v-if="sort.field === 'status_code'"
              class="bi text-title"
              :class="[generatedClass]"
            ></i>
          </div>
        </th>
        <th>
          <div
            class="table-sort-link"
            @click="
              handleSort('created_at', sort.field === 'created_at' ? getOpositeDirection() : 'asc')
            "
          >
            <span>Timestamp</span>
            <i
              v-if="sort.field === 'created_at'"
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
      <template v-for="transaction in transactions" :key="transaction.created_at.toString()">
        <tr>
          <td>{{ getTransactionId(transaction) }}</td>
          <td>
            <span class="text-bold">{{ transaction.type }}</span>
          </td>
          <td>
            <span
              class="badge bg-success text-break"
              :class="{ 'bg-danger': ![0, 22].includes(transaction.status_code) }"
              >{{ getTransactionStatus(transaction) }}</span
            >
          </td>
          <td>
            <span class="text-secondary">
              {{ getTransactionDate(transaction) }}
            </span>
          </td>
          <td class="text-center">
            <AppButton @click="handleTransactionDetailsClick(transaction)" color="primary"
              >Details</AppButton
            >
          </td>
        </tr>
      </template>
    </tbody>
  </table>
  <div class="row justify-content-center">
    <div class="col-4 d-grid">
      <AppButton color="primary" @click="handleLoadMore">Load more</AppButton>
    </div>
  </div>
</template>
