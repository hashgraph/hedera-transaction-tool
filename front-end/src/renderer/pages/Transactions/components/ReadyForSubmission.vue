<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';

import { Transaction } from '@hashgraph/sdk';

import { ITransaction, TransactionStatus } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import {
  execute,
  getTransactionsForUser,
  getTransactionsForUserCount,
} from '@renderer/services/organization';
import { hexToUint8ArrayBatch } from '@renderer/services/electronUtilsService';

import {
  getTransactionDate,
  getTransactionId,
  getTransactionType,
} from '@renderer/utils/sdk/transactions';
import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const toast = useToast();

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
const loadingButtonIndexes = ref<number[]>([]);

/* Handlers */
const handleDetails = async (id: number) => {
  router.push({
    name: 'transactionDetails',
    params: { id },
  });
};

const handleExecute = async (id: number, btnIndex: number) => {
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    throw new Error('Please login in an organization');
  }

  loadingButtonIndexes.value.push(btnIndex);

  try {
    await execute(user.selectedOrganization.serverUrl, id);
    toast.success('Transaction executed successfully');

    router.push({
      name: 'transactions',
    });
  } catch (error) {
    await fetchTransactions();
    toast.error('Internal server error');
  } finally {
    loadingButtonIndexes.value = loadingButtonIndexes.value.filter(i => i !== btnIndex);
  }
};

/* Functions */
function createFindArgs() {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  return {
    skip: (currentPage.value - 1) * pageSize.value,
    take: pageSize.value,
  };
}

async function fetchTransactions() {
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    throw new Error('Please login in an organization');
  }

  isLoading.value = true;
  try {
    const { skip, take } = createFindArgs();
    totalItems.value = await getTransactionsForUserCount(
      user.selectedOrganization.serverUrl,
      TransactionStatus.WAITING_FOR_EXECUTION,
    );
    const rawTransactions = await getTransactionsForUser(
      user.selectedOrganization.serverUrl,
      TransactionStatus.WAITING_FOR_EXECUTION,
      skip,
      take,
    );

    const transactionsBytes = await hexToUint8ArrayBatch(rawTransactions.map(t => t.body));
    transactions.value = rawTransactions.map((transaction, i) => ({
      transactionRaw: transaction,
      transaction: Transaction.fromBytes(transactionsBytes[i]),
    }));
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
                <div class="table-sort-link">
                  <span>Transaction ID</span>
                </div>
              </th>
              <th>
                <div class="table-sort-link">
                  <span>Transaction Type</span>
                </div>
              </th>
              <th>
                <div class="table-sort-link">
                  <span>Valid Start</span>
                </div>
              </th>
              <th class="text-center">
                <span>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(tx, i) in transactions" :key="tx.transactionRaw.id">
              <tr>
                <td>
                  {{
                    tx.transaction instanceof Transaction ? getTransactionId(tx.transaction) : 'N/A'
                  }}
                </td>
                <td>
                  <span class="text-bold">{{
                    tx.transaction instanceof Transaction
                      ? getTransactionType(tx.transaction)
                      : 'N/A'
                  }}</span>
                </td>
                <td>
                  {{
                    tx.transaction instanceof Transaction
                      ? getTransactionDate(tx.transaction)
                      : 'N/A'
                  }}
                </td>
                <td>
                  <AppButton
                    @click="handleDetails(tx.transactionRaw.id)"
                    color="borderless"
                    class="min-w-unset"
                    >Details</AppButton
                  >
                  <AppButton
                    v-if="new Date(tx.transactionRaw.validStart) <= new Date()"
                    @click="handleExecute(tx.transactionRaw.id, i)"
                    color="secondary"
                    class="min-w-unset ms-3"
                    :loading="loadingButtonIndexes.includes(i)"
                    :disabled="loadingButtonIndexes.includes(i)"
                    >Execute</AppButton
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
