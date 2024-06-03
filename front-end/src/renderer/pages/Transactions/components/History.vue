<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { Prisma, Transaction } from '@prisma/client';

import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import { ITransaction, TransactionStatus } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRouter } from 'vue-router';
import useDisposableWs from '@renderer/composables/useDisposableWs';

import { getTransactions, getTransactionsCount } from '@renderer/services/transactionService';
import { getTransactionsForUser } from '@renderer/services/organization';
import { hexToUint8ArrayBatch } from '@renderer/services/electronUtilsService';

import {
  getTransactionStatus,
  getTransactionId,
  getStatusFromCode,
} from '@renderer/utils/transactions';
import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils/userStoreHelpers';
import { getDateStringExtended } from '@renderer/utils';
import * as sdkTransactionUtils from '@renderer/utils/sdk/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const router = useRouter();
const ws = useDisposableWs();

/* State */
const organizationTransactions = ref<
  {
    transactionRaw: ITransaction;
    transaction: SDKTransaction;
  }[]
>([]);
const transactions = ref<Transaction[]>([]);
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

  await fetchTransactions();
};

const handleTransactionDetailsClick = id => {
  router.push({
    name: 'transactionDetails',
    params: { id },
  });
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

async function fetchTransactions() {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  isLoading.value = true;
  try {
    if (isLoggedInOrganization(user.selectedOrganization)) {
      if (user.selectedOrganization.isPasswordTemporary) return;

      const { totalItems: totalItemsCount, items: rawTransactions } = await getTransactionsForUser(
        user.selectedOrganization.serverUrl,
        [TransactionStatus.EXECUTED, TransactionStatus.FAILED, TransactionStatus.EXPIRED],
        network.network,
        currentPage.value,
        pageSize.value,
        [{ property: orgSort.field, direction: orgSort.direction }],
      );
      totalItems.value = totalItemsCount;
      const transactionsBytes = await hexToUint8ArrayBatch(rawTransactions.map(t => t.body));
      organizationTransactions.value = rawTransactions.map((transaction, i) => ({
        transactionRaw: transaction,
        transaction: SDKTransaction.fromBytes(transactionsBytes[i]),
      }));
    } else {
      totalItems.value = await getTransactionsCount(user.personal.id);
      transactions.value = await getTransactions(createFindArgs());
    }
  } finally {
    isLoading.value = false;
  }
}

/* Hooks */
onBeforeMount(async () => {
  ws.on('transaction_action', async () => {
    await fetchTransactions();
  });
  await fetchTransactions();
});

/* Watchers */
watch([currentPage, pageSize, () => user.selectedOrganization], async () => {
  await fetchTransactions();
});

watch(
  () => user.selectedOrganization,
  async () => {
    ws.off('transaction_action');
    ws.on('transaction_action', async () => {
      await fetchTransactions();
    });
  },
);
</script>

<template>
  <div class="fill-remaining overflow-x-auto">
    <template v-if="isLoading">
      <AppLoader />
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
                v-for="transaction in transactions"
                :key="transaction.created_at.toString()"
              >
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
                    <span class="text-small text-secondary">
                      {{ getDateStringExtended(transaction.created_at) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <AppButton
                      @click="handleTransactionDetailsClick(transaction.id)"
                      color="secondary"
                      >Details</AppButton
                    >
                  </td>
                </tr>
              </template>
            </template>
            <template v-else-if="isLoggedInOrganization(user.selectedOrganization)">
              <template
                v-for="{ transaction, transactionRaw } in organizationTransactions"
                :key="transactionRaw.id"
              >
                <tr v-if="transaction instanceof SDKTransaction && true">
                  <td>{{ sdkTransactionUtils.getTransactionId(transaction) }}</td>
                  <td>
                    <span class="text-bold">{{
                      sdkTransactionUtils.getTransactionType(transaction)
                    }}</span>
                  </td>
                  <td>
                    <span
                      class="badge bg-success text-break"
                      :class="{ 'bg-danger': ![0, 22].includes(transactionRaw.statusCode || -1) }"
                      >{{ getStatusFromCode(transactionRaw.statusCode) }}</span
                    >
                  </td>
                  <td>
                    <span class="text-small text-secondary">
                      {{ getDateStringExtended(new Date(transactionRaw.createdAt)) }}
                    </span>
                  </td>
                  <td>
                    <span class="text-small text-secondary">
                      {{
                        transactionRaw.executedAt
                          ? getDateStringExtended(new Date(transactionRaw.executedAt))
                          : 'N/A'
                      }}
                    </span>
                  </td>
                  <td class="text-center">
                    <AppButton
                      @click="handleTransactionDetailsClick(transactionRaw.id)"
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
        <EmptyTransactions class="absolute-centered w-100" />
      </template>
    </template>
  </div>
</template>
