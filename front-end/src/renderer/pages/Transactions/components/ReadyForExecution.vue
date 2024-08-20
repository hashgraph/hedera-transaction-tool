<script setup lang="ts">
import { computed, onBeforeMount, onMounted, reactive, ref, watch } from 'vue';

import { Transaction } from '@hashgraph/sdk';

import { ITransaction, TransactionStatus, NotificationType } from '@main/shared/interfaces';
import { TRANSACTION_ACTION } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useNotificationsStore from '@renderer/stores/storeNotifications';

import { useRouter } from 'vue-router';
import useDisposableWs from '@renderer/composables/useDisposableWs';

import { getTransactionsForUser } from '@renderer/services/organization';
import { hexToUint8ArrayBatch } from '@renderer/services/electronUtilsService';

import {
  getTransactionDateExtended,
  getTransactionId,
  getTransactionType,
} from '@renderer/utils/sdk/transactions';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const notifications = useNotificationsStore();

/* Composables */
const router = useRouter();
const ws = useDisposableWs();

/* State */
const transactions = ref<
  {
    transactionRaw: ITransaction;
    transaction: Transaction;
  }[]
>([]);
const totalItems = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const isLoading = ref(true);

const sort = reactive<{
  field: keyof ITransaction;
  direction: 'asc' | 'desc';
}>({
  field: 'createdAt',
  direction: 'desc',
});

/* Computed */
const generatedClass = computed(() => {
  return sort.direction === 'desc' ? 'bi-arrow-down-short' : 'bi-arrow-up-short';
});

/* Handlers */
const handleDetails = async (id: number) => {
  router.push({
    name: 'transactionDetails',
    params: { id },
  });
};

const handleSort = async (field: keyof ITransaction, direction: 'asc' | 'desc') => {
  sort.field = field;
  sort.direction = direction;
  await fetchTransactions();
};

/* Functions */
async function fetchTransactions() {
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    return;
  }

  if (user.selectedOrganization.isPasswordTemporary) return;

  isLoading.value = true;
  try {
    const { totalItems: totalItemsCount, items: rawTransactions } = await getTransactionsForUser(
      user.selectedOrganization.serverUrl,
      [TransactionStatus.WAITING_FOR_EXECUTION],
      network.network,
      currentPage.value,
      pageSize.value,
      [{ property: sort.field, direction: sort.direction }],
    );
    totalItems.value = totalItemsCount;
    const transactionsBytes = await hexToUint8ArrayBatch(rawTransactions.map(t => t.body));
    transactions.value = rawTransactions.map((transaction, i) => ({
      transactionRaw: transaction,
      transaction: Transaction.fromBytes(transactionsBytes[i]),
    }));
  } finally {
    isLoading.value = false;
  }
}

function getOpositeDirection() {
  return sort.direction === 'asc' ? 'desc' : 'asc';
}

/* Hooks */
onBeforeMount(async () => {
  ws.on(TRANSACTION_ACTION, async () => {
    await fetchTransactions();
  });
  await fetchTransactions();
});

onMounted(async () => {
  await notifications.markAsRead(NotificationType.TRANSACTION_INDICATOR_EXECUTABLE);
});

/* Watchers */
watch([currentPage, pageSize, () => user.selectedOrganization], async () => {
  await fetchTransactions();
});
</script>

<template>
  <div class="fill-remaining overflow-x-auto">
    <template v-if="isLoading">
      <AppLoader class="h-100" />
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
                      'transactionId',
                      sort.field === 'transactionId' ? getOpositeDirection() : 'asc',
                    )
                  "
                >
                  <span>Transaction ID</span>
                  <i
                    v-if="sort.field === 'transactionId'"
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
                      'validStart',
                      sort.field === 'validStart' ? getOpositeDirection() : 'asc',
                    )
                  "
                >
                  <span>Valid Start</span>
                  <i
                    v-if="sort.field === 'validStart'"
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
            <template v-for="(tx, index) in transactions" :key="tx.transactionRaw.id">
              <tr>
                <td :data-testid="`td-transaction-id-ready-execution-${index}`">
                  {{
                    tx.transaction instanceof Transaction ? getTransactionId(tx.transaction) : 'N/A'
                  }}
                </td>
                <td :data-testid="`td-transaction-type-ready-execution-${index}`">
                  <span class="text-bold">{{
                    tx.transaction instanceof Transaction
                      ? getTransactionType(tx.transaction)
                      : 'N/A'
                  }}</span>
                </td>
                <td :data-testid="`td-transaction-valid-start-ready-execution-${index}`">
                  {{
                    tx.transaction instanceof Transaction
                      ? getTransactionDateExtended(tx.transaction)
                      : 'N/A'
                  }}
                </td>
                <td class="text-center">
                  <AppButton
                    @click="handleDetails(tx.transactionRaw.id)"
                    :data-testid="`button-transaction-ready-execution-details-${index}`"
                    color="secondary"
                    class="min-w-unset"
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
