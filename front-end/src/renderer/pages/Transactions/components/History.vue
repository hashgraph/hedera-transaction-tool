<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { Prisma, Transaction } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getTransactions, getTransactionsCount } from '@renderer/services/transactionService';

import {
  getTransactionStatus,
  getTransactionId,
  openTransactionInHashscan,
} from '@renderer/utils/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const transactions = ref<Transaction[]>([]);
const sort = reactive<{ field: Prisma.TransactionScalarFieldEnum; direction: Prisma.SortOrder }>({
  field: 'created_at',
  direction: 'desc',
});
const totalItems = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const isLoading = ref(true);

/* Computed */
const generatedClass = computed(() => {
  return sort.direction === 'desc' ? 'bi-arrow-down-short' : 'bi-arrow-up-short';
});

/* Handlers */
const handleSort = async (
  field: Prisma.TransactionScalarFieldEnum,
  direction: Prisma.SortOrder,
) => {
  sort.field = field;
  sort.direction = direction;
  transactions.value = await getTransactions(createFindArgs());
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
    orderBy: {
      [sort.field]: sort.direction,
    },
    skip: (currentPage.value - 1) * pageSize.value,
    take: pageSize.value,
  };
}

/* Hooks */
onBeforeMount(async () => {
  try {
    totalItems.value = await getTransactionsCount(user.data.id);
    transactions.value = await getTransactions(createFindArgs());
    handleSort(sort.field, sort.direction);
  } finally {
    isLoading.value = false;
  }
});

/* Watchers */
watch([currentPage, pageSize], async () => {
  isLoading.value = true;
  try {
    transactions.value = await getTransactions(createFindArgs());
    handleSort(sort.field, sort.direction);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="fill-remaining overflow-x-auto">
    <template v-if="isLoading">
      <AppLoader />
    </template>
    <template v-else>
      <template v-if="transactions.length > 0">
        <table class="table-custom">
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
                    handleSort(
                      'created_at',
                      sort.field === 'created_at' ? getOpositeDirection() : 'asc',
                    )
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
                    {{ transaction.created_at.toDateString() }}
                  </span>
                </td>
                <td class="text-center">
                  <AppButton @click="handleTransactionDetailsClick(transaction)" color="secondary"
                    >Details</AppButton
                  >
                </td>
              </tr>
            </template>
          </tbody>
          <tfoot class="d-table-caption">
            <tr class="d-inline">
              <AppPager
                v-model:current-page="currentPage"
                v-model:per-page="pageSize"
                :total-items="totalItems"
              />
            </tr>
          </tfoot>
        </table>
      </template>
      <template v-else>
        <EmptyTransactions class="absolute-centered w-100" />
      </template>
    </template>
  </div>
</template>
