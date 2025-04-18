<script setup lang="ts">
import type { ITransaction } from '@main/shared/interfaces';
import type { Transaction } from '@prisma/client';

import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { Prisma } from '@prisma/client';

import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import { NotificationType, TransactionStatus } from '@main/shared/interfaces';
import { TRANSACTION_ACTION } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useNotificationsStore from '@renderer/stores/storeNotifications';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';

import { useRouter } from 'vue-router';
import useDisposableWs from '@renderer/composables/useDisposableWs';
import useMarkNotifications from '@renderer/composables/useMarkNotifications';
import useNextTransactionStore from '@renderer/stores/storeNextTransaction';

import { getTransactions, getTransactionsCount } from '@renderer/services/transactionService';
import { getHistoryTransactions } from '@renderer/services/organization';

import {
  getTransactionStatus,
  getTransactionId,
  getStatusFromCode,
  getNotifiedTransactions,
  getDateStringExtended,
  hexToUint8Array,
  redirectToDetails,
  isLoggedInOrganization,
  isUserLoggedIn,
} from '@renderer/utils';
import * as sdkTransactionUtils from '@renderer/utils/sdk/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import TransactionsFilter from '@renderer/components/Filter/TransactionsFilter.vue';

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
  NotificationType.TRANSACTION_INDICATOR_EXECUTED,
  NotificationType.TRANSACTION_INDICATOR_EXPIRED,
  NotificationType.TRANSACTION_INDICATOR_ARCHIVED,
  NotificationType.TRANSACTION_INDICATOR_CANCELLED,
  NotificationType.TRANSACTION_INDICATOR_FAILED,
]);

/* State */
const organizationTransactions = ref<
  {
    transactionRaw: ITransaction;
    transaction: SDKTransaction;
  }[]
>([]);
const transactions = ref<Transaction[]>([]);
const notifiedTransactionIds = ref<number[]>([]);
const localSort = reactive<{
  field: Prisma.TransactionScalarFieldEnum;
  direction: Prisma.SortOrder;
}>({
  field: 'created_at',
  direction: 'desc',
});
const orgSort = reactive<{
  field: keyof ITransaction;
  direction: 'asc' | 'desc';
}>({
  field: 'createdAt',
  direction: 'desc',
});
const orgFilters = ref<
  {
    property: keyof ITransaction;
    rule: string;
    value: string;
  }[]
>([{ property: 'mirrorNetwork', rule: 'eq', value: network.network }]);
const totalItems = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const isLoading = ref(true);

/* Computed */
const generatedClass = computed(() => {
  return localSort.direction === 'desc' ? 'bi-arrow-down-short' : 'bi-arrow-up-short';
});

/* Handlers */
const handleSort = async (
  field: Prisma.TransactionScalarFieldEnum,
  direction: Prisma.SortOrder,
  organizationField: keyof ITransaction,
) => {
  localSort.field = field;
  localSort.direction = direction;
  orgSort.field = organizationField;
  orgSort.direction = direction;

  setGetTransactionsFunction();
  await fetchTransactions();
};

const handleDetails = (id: string | number) => {
  setPreviousTransactionsIds(id);
  redirectToDetails(router, id, true);
};

/* Functions */
function getOpositeDirection() {
  return localSort.direction === 'asc' ? 'desc' : 'asc';
}

function createFindArgs(): Prisma.TransactionFindManyArgs {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  return {
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
    orderBy: {
      [localSort.field]: localSort.direction,
    },
    skip: (currentPage.value - 1) * pageSize.value,
    take: pageSize.value,
  };
}

function setNotifiedTransactions() {
  const notificationsKey = user.selectedOrganization?.serverUrl || '';

  notifiedTransactionIds.value = getNotifiedTransactions(
    notifications.notifications[notificationsKey]?.concat(oldNotifications.value) || [],
    organizationTransactions.value.map(t => t.transactionRaw),
    [
      NotificationType.TRANSACTION_INDICATOR_EXECUTED,
      NotificationType.TRANSACTION_INDICATOR_EXPIRED,
      NotificationType.TRANSACTION_INDICATOR_ARCHIVED,
      NotificationType.TRANSACTION_INDICATOR_CANCELLED,
      NotificationType.TRANSACTION_INDICATOR_FAILED,
    ],
  );
}

async function fetchTransactions() {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  isLoading.value = true;
  try {
    if (isLoggedInOrganization(user.selectedOrganization)) {
      if (user.selectedOrganization.isPasswordTemporary) return;

      const { totalItems: totalItemsCount, items: rawTransactions } = await getHistoryTransactions(
        user.selectedOrganization.serverUrl,
        currentPage.value,
        pageSize.value,
        orgFilters.value,
        [{ property: orgSort.field, direction: orgSort.direction }],
      );
      totalItems.value = totalItemsCount;

      const transactionsBytes = rawTransactions.map(t => hexToUint8Array(t.transactionBytes));
      organizationTransactions.value = rawTransactions.map((transaction, i) => ({
        transactionRaw: transaction,
        transaction: SDKTransaction.fromBytes(transactionsBytes[i]),
      }));

      setNotifiedTransactions();
    } else {
      notifiedTransactionIds.value = [];
      totalItems.value = await getTransactionsCount(user.personal.id);
      transactions.value = await getTransactions(createFindArgs());
    }
  } finally {
    isLoading.value = false;
  }
}

function setGetTransactionsFunction() {
  nextTransaction.setGetTransactionsFunction(async (page: number | null, size: number | null) => {
    if (isLoggedInOrganization(user.selectedOrganization)) {
      const { items, totalItems } = await getHistoryTransactions(
        user.selectedOrganization.serverUrl,
        page || 1,
        size || 10,
        orgFilters.value,
        [{ property: orgSort.field, direction: orgSort.direction }],
      );
      return {
        items: items.map(t => t.id),
        totalItems,
      };
    } else {
      if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
      totalItems.value = await getTransactionsCount(user.personal.id);
      const findArgs = createFindArgs();
      findArgs.skip = ((page || 1) - 1) * (size || 10);
      findArgs.take = size || 10;
      transactions.value = await getTransactions(createFindArgs());

      return {
        items: transactions.value.map(t => t.id),
        totalItems: totalItems.value,
      };
    }
  }, true);
}

function setPreviousTransactionsIds(id: string | number) {
  if (isLoggedInOrganization(user.selectedOrganization)) {
    const selectedTransactionIndex = organizationTransactions.value.findIndex(
      t => t.transactionRaw.id === id,
    );
    const previousTransactionIds = organizationTransactions.value
      .slice(0, selectedTransactionIndex)
      .map(t => t.transactionRaw.id);
    nextTransaction.setPreviousTransactionsIds(previousTransactionIds);
  } else {
    const selectedTransactionIndex = transactions.value.findIndex(t => t.id === id);
    const previousTransactionIds = transactions.value
      .slice(0, selectedTransactionIndex)
      .map(t => t.id);
    nextTransaction.setPreviousTransactionsIds(previousTransactionIds);
  }
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

watch([currentPage, pageSize, () => user.selectedOrganization, orgFilters], async () => {
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
    <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="mt-3 mb-3">
      <TransactionsFilter
        v-model:filters="orgFilters"
        toggler-class="d-flex align-items-center text-dark-emphasis min-w-unset border-0 p-0"
        :history="true"
        :inline="true"
      />
    </div>
    <template v-if="isLoading">
      <AppLoader class="h-100" />
    </template>
    <template v-else>
      <template
        v-if="
          (isLoggedInOrganization(user.selectedOrganization) &&
            organizationTransactions.length > 0) ||
          transactions.length > 0
        "
      >
        <table class="table-custom">
          <thead>
            <tr>
              <th>
                <div
                  class="table-sort-link"
                  @click="
                    handleSort(
                      'transaction_id',
                      localSort.field === 'transaction_id' ? getOpositeDirection() : 'asc',
                      'transactionId',
                    )
                  "
                >
                  <span>Transaction ID</span>
                  <i
                    v-if="localSort.field === 'transaction_id'"
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
                      'type',
                      localSort.field === 'type' ? getOpositeDirection() : 'asc',
                      'type',
                    )
                  "
                >
                  <span>Transaction Type</span>
                  <i
                    v-if="localSort.field === 'type'"
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
                      localSort.field === 'status_code' ? getOpositeDirection() : 'asc',
                      'statusCode',
                    )
                  "
                >
                  <span>Status</span>
                  <i
                    v-if="localSort.field === 'status_code'"
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
                      localSort.field === 'created_at' ? getOpositeDirection() : 'asc',
                      'createdAt',
                    )
                  "
                >
                  <span>Created At</span>
                  <i
                    v-if="localSort.field === 'created_at'"
                    class="bi text-title"
                    :class="[generatedClass]"
                  ></i>
                </div>
              </th>
              <th v-if="user.selectedOrganization">
                <div
                  class="table-sort-link"
                  @click="
                    handleSort(
                      'executed_at',
                      localSort.field === 'executed_at' ? getOpositeDirection() : 'asc',
                      'executedAt',
                    )
                  "
                >
                  <span>Executed At</span>
                  <i
                    v-if="localSort.field === 'executed_at'"
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
            <template v-if="!user.selectedOrganization">
              <template
                v-for="(transaction, index) in transactions"
                :key="transaction.created_at.toString()"
              >
                <tr>
                  <td :data-testid="`td-transaction-id-${index}`">
                    {{ getTransactionId(transaction) }}
                  </td>
                  <td :data-testid="`td-transaction-type-${index}`">
                    <span class="text-bold">{{ transaction.type }}</span>
                  </td>
                  <td :data-testid="`td-transaction-status-${index}`">
                    <span
                      class="badge bg-success text-break"
                      :class="{ 'bg-danger': ![0, 22, 338].includes(transaction.status_code) }"
                      >{{ getTransactionStatus(transaction) }}</span
                    >
                  </td>
                  <td :data-testid="`td-transaction-createdAt-${index}`">
                    <span class="text-small text-secondary">
                      {{ getDateStringExtended(transaction.created_at) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <AppButton
                      :data-testid="`button-transaction-details-${index}`"
                      @click="handleDetails(transaction.id)"
                      color="secondary"
                      class="min-w-unset"
                      >Details</AppButton
                    >
                  </td>
                </tr>
              </template>
            </template>
            <template v-else-if="isLoggedInOrganization(user.selectedOrganization)">
              <template
                v-for="(transactionData, index) in organizationTransactions"
                :key="transactionData.transactionRaw.id"
              >
                <tr
                  v-if="transactionData.transaction instanceof SDKTransaction && true"
                  :class="{
                    highlight: notifiedTransactionIds.includes(transactionData.transactionRaw.id),
                  }"
                  :id="transactionData.transactionRaw.id.toString()"
                >
                  <td :data-testid="`td-transaction-id-${index}`">
                    {{ sdkTransactionUtils.getTransactionId(transactionData.transaction) }}
                  </td>
                  <td :data-testid="`td-transaction-type-${index}`">
                    <span class="text-bold">{{
                      sdkTransactionUtils.getTransactionType(transactionData.transaction)
                    }}</span>
                  </td>
                  <td :data-testid="`td-transaction-status-${index}`">
                    <span
                      class="badge bg-success text-break"
                      :class="{
                        'bg-danger':
                          ![0, 22, 104].includes(transactionData.transactionRaw.statusCode || -1) &&
                          transactionData.transactionRaw.status !== TransactionStatus.ARCHIVED,
                      }"
                      >{{
                        getStatusFromCode(transactionData.transactionRaw.statusCode)
                          ? getStatusFromCode(transactionData.transactionRaw.statusCode)
                          : transactionData.transactionRaw.status === TransactionStatus.EXPIRED
                            ? 'EXPIRED'
                            : transactionData.transactionRaw.status === TransactionStatus.ARCHIVED
                              ? 'ARCHIVED'
                              : 'CANCELED'
                      }}</span
                    >
                  </td>
                  <td :data-testid="`td-transaction-createdAt-${index}`">
                    <span class="text-small text-secondary">
                      {{
                        getDateStringExtended(new Date(transactionData.transactionRaw.createdAt))
                      }}
                    </span>
                  </td>
                  <td>
                    <span
                      :data-testid="`td-transaction-executedAt-${index}`"
                      class="text-small text-secondary"
                    >
                      {{
                        transactionData.transactionRaw.executedAt
                          ? getDateStringExtended(
                              new Date(transactionData.transactionRaw.executedAt),
                            )
                          : 'N/A'
                      }}
                    </span>
                  </td>
                  <td class="text-center">
                    <AppButton
                      :data-testid="`button-transaction-details-${index}`"
                      @click="handleDetails(transactionData.transactionRaw.id)"
                      color="secondary"
                      class="min-w-unset"
                      >Details</AppButton
                    >
                  </td>
                </tr>
              </template>
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
