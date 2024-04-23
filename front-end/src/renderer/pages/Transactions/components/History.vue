<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { Prisma, Transaction } from '@prisma/client';

import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import { ITransaction, TransactionStatus } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRouter } from 'vue-router';

import { getTransactions, getTransactionsCount } from '@renderer/services/transactionService';
import {
  getTransactionsForUser,
  getTransactionsForUserCount,
} from '@renderer/services/organization';
import { hexToUint8ArrayBatch } from '@renderer/services/electronUtilsService';

import {
  getTransactionStatus,
  getTransactionId,
  openTransactionInHashscan,
  getStatusFromCode,
} from '@renderer/utils/transactions';
import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils/userStoreHelpers';
import * as sdkTransactionUtils from '@renderer/utils/sdk/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import { getDateStringExtended } from '@renderer/utils';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const router = useRouter();

/* State */
const organizationTransactions = ref<
  {
    transactionRaw: ITransaction;
    transaction: SDKTransaction;
  }[]
>([]);
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

const handleTransactionDetailsClick = (transaction: Transaction | number) => {
  if (typeof transaction === 'number') {
    router.push({
      name: 'transactionDetails',
      params: { id: transaction },
    });
  } else {
    openTransactionInHashscan(transaction.transaction_id, network.network);
  }
};

/* Functions */
function getOpositeDirection() {
  return sort.direction === 'asc' ? 'desc' : 'asc';
}

function createFindArgs() {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  return {
    where: {
      user_id: user.personal.id,
    },
    orderBy: {
      [sort.field]: sort.direction,
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
    const args = createFindArgs();

    if (isLoggedInOrganization(user.selectedOrganization)) {
      totalItems.value = await getTransactionsForUserCount(user.selectedOrganization.serverUrl, [
        TransactionStatus.EXECUTED,
        TransactionStatus.FAILED,
      ]);
      const rawTransactions = await getTransactionsForUser(
        user.selectedOrganization.serverUrl,
        [TransactionStatus.EXECUTED, TransactionStatus.FAILED],
        args.skip,
        args.take,
      );

      const transactionsBytes = await hexToUint8ArrayBatch(rawTransactions.map(t => t.body));
      organizationTransactions.value = rawTransactions.map((transaction, i) => ({
        transactionRaw: transaction,
        transaction: SDKTransaction.fromBytes(transactionsBytes[i]),
      }));
    } else {
      totalItems.value = await getTransactionsCount(user.personal.id);
      transactions.value = await getTransactions(args);
      handleSort(sort.field, sort.direction);
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
watch([currentPage, pageSize], async () => {
  await fetchTransactions();
});

watch(
  () => user.selectedOrganization,
  async () => {
    await fetchTransactions();
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
                      sort.field === 'transaction_id' ? getOpositeDirection() : 'asc',
                    )
                  "
                >
                  <span>Transaction ID</span>
                  <i
                    v-if="!user.selectedOrganization && sort.field === 'transaction_id'"
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
                    v-if="!user.selectedOrganization && sort.field === 'type'"
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
                    v-if="!user.selectedOrganization && sort.field === 'status_code'"
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
                    v-if="!user.selectedOrganization && sort.field === 'created_at'"
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
                      v-if="transactionRaw.statusCode"
                      class="badge bg-success text-break"
                      :class="{ 'bg-danger': ![0, 22].includes(transactionRaw.statusCode) }"
                      >{{ getStatusFromCode(transactionRaw.statusCode) }}</span
                    >
                  </td>
                  <td>
                    <span class="text-secondary">
                      {{ getDateStringExtended(new Date(transactionRaw.createdAt)) }}
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
