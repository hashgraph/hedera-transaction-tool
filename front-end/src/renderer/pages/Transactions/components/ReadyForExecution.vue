<script setup lang="ts">
import type { ITransaction } from '@shared/interfaces';

import { computed, onBeforeMount, reactive, ref, watch } from 'vue';

import { Transaction } from '@hashgraph/sdk';

import { TransactionStatus, NotificationType } from '@shared/interfaces';
import { TRANSACTION_ACTION } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useNotificationsStore from '@renderer/stores/storeNotifications';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useNextTransactionStore from '@renderer/stores/storeNextTransaction';

import { useRouter } from 'vue-router';
import useDisposableWs from '@renderer/composables/useDisposableWs';
import useMarkNotifications from '@renderer/composables/useMarkNotifications';

import { getTransactionsForUser } from '@renderer/services/organization';

import {
  getNotifiedTransactions,
  hexToUint8Array,
  redirectToDetails,
  isLoggedInOrganization,
} from '@renderer/utils';
import {
  getTransactionDateExtended,
  getTransactionId,
  getTransactionType,
} from '@renderer/utils/sdk/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const notifications = useNotificationsStore();
const wsStore = useWebsocketConnection();
const nextTransaction = useNextTransactionStore();

/* Composables */
const router = useRouter();
const ws = useDisposableWs();
const { oldNotifications } = useMarkNotifications([
  NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
]);

/* State */
const transactions = ref<
  {
    transactionRaw: ITransaction;
    transaction: Transaction;
  }[]
>([]);
const notifiedTransactionIds = ref<number[]>([]);
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
  const selectedTransactionIndex = transactions.value.findIndex(t => t.transactionRaw.id === id);
  const previousTransactionIds = transactions.value
    .slice(0, selectedTransactionIndex)
    .map(t => t.transactionRaw.id);
  nextTransaction.setPreviousTransactionsIds(previousTransactionIds);

  redirectToDetails(router, id, true);
};

const handleSort = async (field: keyof ITransaction, direction: 'asc' | 'desc') => {
  sort.field = field;
  sort.direction = direction;
  setGetTransactionsFunction();
  await fetchTransactions();
};

/* Functions */
function setNotifiedTransactions() {
  const notificationsKey = user.selectedOrganization?.serverUrl || '';

  notifiedTransactionIds.value = getNotifiedTransactions(
    notifications.notifications[notificationsKey]?.concat(oldNotifications.value) || [],
    transactions.value.map(t => t.transactionRaw),
    [NotificationType.TRANSACTION_INDICATOR_EXECUTABLE],
  );
}

async function fetchTransactions() {
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    notifiedTransactionIds.value = [];
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

    const transactionsBytes = rawTransactions.map(t => hexToUint8Array(t.transactionBytes));
    transactions.value = rawTransactions.map((transaction, i) => ({
      transactionRaw: transaction,
      transaction: Transaction.fromBytes(transactionsBytes[i]),
    }));

    setNotifiedTransactions();
  } finally {
    isLoading.value = false;
  }
}

function setGetTransactionsFunction() {
  nextTransaction.setGetTransactionsFunction(async (page: number | null, size: number | null) => {
    if (!isLoggedInOrganization(user.selectedOrganization))
      throw new Error('User not logged in organization');

    const { items, totalItems } = await getTransactionsForUser(
      user.selectedOrganization.serverUrl,
      [TransactionStatus.WAITING_FOR_EXECUTION],
      network.network,
      page || 1,
      size || 10,
      [{ property: sort.field, direction: sort.direction }],
    );

    return {
      items: items.map(t => t.id),
      totalItems,
    };
  }, true);
}

function getOpositeDirection() {
  return sort.direction === 'asc' ? 'desc' : 'asc';
}

const subscribeToTransactionAction = () => {
  if (!user.selectedOrganization?.serverUrl) return;
  ws.on(user.selectedOrganization?.serverUrl, TRANSACTION_ACTION, async () => {
    await fetchTransactions();
  });
};

/* Hooks */
onBeforeMount(async () => {
  subscribeToTransactionAction();
  setGetTransactionsFunction();
  await fetchTransactions();
});

/* Watchers */
wsStore.$onAction(ctx => {
  if (ctx.name !== 'setup') return;
  ctx.after(() => subscribeToTransactionAction());
});

watch([currentPage, pageSize, () => user.selectedOrganization], async () => {
  setGetTransactionsFunction();
  await fetchTransactions();
});

watch(
  () => notifications.notifications,
  () => {
    setNotifiedTransactions();
  },
);
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
              <tr :class="{ highlight: notifiedTransactionIds.includes(tx.transactionRaw.id) }">
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
        <div class="flex-column-100 flex-centered">
          <EmptyTransactions :mode="'transactions-tab'" />
        </div>
      </template>
    </template>
  </div>
</template>
