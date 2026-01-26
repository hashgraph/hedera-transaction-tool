<script setup lang="ts">
import type { ITransaction } from '@shared/interfaces';
import type { Transaction } from '@prisma/client';

import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { Prisma } from '@prisma/client';

import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import { NotificationType, TransactionStatus } from '@shared/interfaces';
import { TRANSACTION_ACTION } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useNotificationsStore from '@renderer/stores/storeNotifications';
import useNextTransactionV2, {
  type TransactionNodeId,
} from '@renderer/stores/storeNextTransactionV2.ts';

import useMarkNotifications from '@renderer/composables/useMarkNotifications';
import useWebsocketSubscription from '@renderer/composables/useWebsocketSubscription';

import { getTransactions, getTransactionsCount } from '@renderer/services/transactionService';
import { getHistoryTransactions } from '@renderer/services/organization';

import {
  getTransactionStatus,
  getStatusFromCode,
  getNotifiedTransactions,
  hexToUint8Array,
  isLoggedInOrganization,
  isUserLoggedIn,
} from '@renderer/utils';
import * as sdkTransactionUtils from '@renderer/utils/sdk/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import TransactionsFilter from '@renderer/components/Filter/TransactionsFilter.vue';
import DateTimeString from '@renderer/components/ui/DateTimeString.vue';
import TransactionId from '@renderer/components/ui/TransactionId.vue';
import { useRouter } from 'vue-router';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const notifications = useNotificationsStore();
const nextTransaction = useNextTransactionV2();

/* Composables */
useWebsocketSubscription(TRANSACTION_ACTION, fetchTransactions);
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

/* Composables */
const router = useRouter();

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

  await fetchTransactions();
};

const handleDetails = async (id: string | number) => {
  let nodeIds: TransactionNodeId[] = [];
  if (isLoggedInOrganization(user.selectedOrganization)) {
    nodeIds = organizationTransactions.value.map(t => {
      return {
        transactionId: t.transactionRaw.id,
      };
    });
  } else {
    nodeIds = transactions.value.map(t => {
      return {
        transactionId: t.id,
      };
    });
  }
  await nextTransaction.routeDown({ transactionId: id }, nodeIds, router);
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

/* Hooks */
onBeforeMount(async () => {
  await fetchTransactions();
});

/* Watchers */
watch([currentPage, pageSize, () => user.selectedOrganization, orgFilters], async () => {
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
                      'description',
                      localSort.field === 'description' ? getOpositeDirection() : 'asc',
                      'description',
                    )
                  "
                >
                  <span>Description</span>
                  <i
                    v-if="localSort.field === 'description'"
                    :class="[generatedClass]"
                    class="bi text-title"
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
              <th v-if="!user.selectedOrganization">
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
                    <TransactionId :transaction-id="transaction.transaction_id" wrap />
                  </td>
                  <td :data-testid="`td-transaction-type-${index}`">
                    <span class="text-bold">{{ transaction.type }}</span>
                  </td>
                  <td :data-testid="`td-transaction-description-${index}`">
                    <span class="text-wrap-two-line-ellipsis">{{ transaction.description }}</span>
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
                      <DateTimeString :date="transaction.created_at" compact wrap />
                    </span>
                  </td>
                  <td class="text-center">
                    <AppButton
                      :data-testid="`button-transaction-details-${index}`"
                      @click="handleDetails(transaction.id)"
                      color="secondary"
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
                    <TransactionId
                      :transaction-id="transactionData.transaction.transactionId"
                      wrap
                    />
                  </td>
                  <td :data-testid="`td-transaction-type-${index}`">
                    <span class="text-bold">{{
                      sdkTransactionUtils.getTransactionType(
                        transactionData.transaction,
                        false,
                        true,
                      )
                    }}</span>
                  </td>
                  <td :data-testid="`td-transaction-description-${index}`">
                    <span class="text-wrap-two-line-ellipsis">{{
                      transactionData.transactionRaw.description
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
                  <!--
                  <td :data-testid="`td-transaction-createdAt-${index}`">
                    <span class="text-small text-secondary">
                      <DateTimeString
                        :date="new Date(transactionData.transactionRaw.createdAt)"
                        compact
                        wrap
                      />
                    </span>
                  </td>
-->
                  <td>
                    <span
                      :data-testid="`td-transaction-executedAt-${index}`"
                      class="text-small text-secondary"
                    >
                      <DateTimeString
                        v-if="transactionData.transactionRaw.executedAt"
                        :date="new Date(transactionData.transactionRaw.executedAt)"
                        compact
                        wrap
                      />
                      <span v-else>N/A</span>
                    </span>
                  </td>
                  <td class="text-center">
                    <AppButton
                      :data-testid="`button-transaction-details-${index}`"
                      @click="handleDetails(transactionData.transactionRaw.id)"
                      color="secondary"
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
