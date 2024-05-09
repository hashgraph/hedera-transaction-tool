<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';

import { Transaction } from '@hashgraph/sdk';

import { ITransaction } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';

import { getTransactionsToSign } from '@renderer/services/organization';
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
    keysToSign: number[];
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
const handleSign = async (id: number) => {
  router.push({
    name: 'transactionDetails',
    params: { id },
    query: {
      sign: 'true',
    },
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
    throw new Error('Please login in an organization');
  }

  if (user.selectedOrganization.isPasswordTemporary) return;

  isLoading.value = true;
  try {
    const { items: rawTransactions } = await getTransactionsToSign(
      user.selectedOrganization.serverUrl,
      currentPage.value,
      pageSize.value,
      [{ property: sort.field, direction: sort.direction }],
    );
    totalItems.value = rawTransactions.length;
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

function getOpositeDirection() {
  return sort.direction === 'asc' ? 'desc' : 'asc';
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
                <td class="text-center">
                  <AppButton @click="handleSign(tx.transactionRaw.id)" color="secondary"
                    >Sign</AppButton
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
