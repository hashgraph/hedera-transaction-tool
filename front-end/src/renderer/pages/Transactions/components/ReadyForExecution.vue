<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';

import { Transaction } from '@hashgraph/sdk';

import { ITransaction, TransactionStatus } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';

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

/* Composables */
const router = useRouter();

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

/* Handlers */
const handleDetails = async (id: number) => {
  router.push({
    name: 'transactionDetails',
    params: { id },
  });
};

/* Functions */
async function fetchTransactions() {
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    throw new Error('Please login in an organization');
  }

  isLoading.value = true;
  try {
    const { totalItems: totalItemsCount, items: rawTransactions } = await getTransactionsForUser(
      user.selectedOrganization.serverUrl,
      [TransactionStatus.WAITING_FOR_EXECUTION],
      currentPage.value,
      pageSize.value,
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
            <template v-for="tx in transactions" :key="tx.transactionRaw.id">
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
                      ? getTransactionDateExtended(tx.transaction)
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
