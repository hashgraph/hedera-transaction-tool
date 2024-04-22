<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';

import { Transaction } from '@hashgraph/sdk';

import { ITransaction } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';

import { getTransactionsToSign, getTransactionsToSignCount } from '@renderer/services/organization';

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

/* State */
const transactions = ref<
  {
    transactionRaw: ITransaction;
    transaction: Transaction;
    keysToSign: number[];
  }[]
>([]);
const totalItems = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const isLoading = ref(true);

/* Handlers */
const handleSign = (transactionIndex: number) => {
  console.log('click', transactionIndex);
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
    totalItems.value = await getTransactionsToSignCount(user.selectedOrganization.serverUrl);
    const rawTransactions = await getTransactionsToSign(
      user.selectedOrganization.serverUrl,
      skip,
      take,
    );
    const transactionsBytes = await hexToUint8ArrayBatch(
      rawTransactions.map(t => t.transaction.body),
    );
    transactions.value = rawTransactions.map((transaction, i) => ({
      transactionRaw: transaction.transaction,
      transaction: Transaction.fromBytes(transactionsBytes[i]),
      keysToSign: transaction.keysToSign,
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
            <template
              v-for="({ transaction }, i) in transactions"
              :key="transaction.created_at.toString()"
            >
              <tr>
                <td>
                  {{ transaction instanceof Transaction ? getTransactionId(transaction) : 'N/A' }}
                </td>
                <td>
                  <span class="text-bold">{{
                    transaction instanceof Transaction ? getTransactionType(transaction) : 'N/A'
                  }}</span>
                </td>
                <td>
                  {{ transaction instanceof Transaction ? getTransactionDate(transaction) : 'N/A' }}
                </td>
                <td class="text-center">
                  <AppButton @click="handleSign(i)" color="secondary">Sign</AppButton>
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
