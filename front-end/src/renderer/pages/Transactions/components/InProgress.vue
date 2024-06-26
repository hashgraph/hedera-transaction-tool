<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';

import { Transaction } from '@hashgraph/sdk';

import { ITransaction, TransactionStatus } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRouter } from 'vue-router';
import useDisposableWs from '@renderer/composables/useDisposableWs';

import { getApiGroups, getTransactionsForUser } from '@renderer/services/organization';
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

/* Composables */
const router = useRouter();
const ws = useDisposableWs();

/* State */
const transactions = ref<
  Map<
    number,
    {
      transactionRaw: ITransaction;
      transaction: Transaction;
    }[]
  >
>(new Map());
const groups = ref();
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

async function handleGroupDetails(id: number) {
  router.push({
    name: 'transactionGroupDetails',
    params: { id },
  });
}

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
      [TransactionStatus.WAITING_FOR_SIGNATURES],
      network.network,
      currentPage.value,
      pageSize.value,
      [{ property: sort.field, direction: sort.direction }],
    );
    console.log(rawTransactions);
    totalItems.value = totalItemsCount;
    const transactionsBytes = await hexToUint8ArrayBatch(rawTransactions.map(t => t.body));

    for (const [i, transaction] of rawTransactions.entries()) {
      const currentGroup = transaction.groupItem.groupId ? transaction.groupItem.groupId : -1;
      const currentVal = transactions.value.get(currentGroup);
      const newVal = {
        transactionRaw: transaction,
        transaction: Transaction.fromBytes(transactionsBytes[i]),
      };
      if (currentVal != undefined) {
        currentVal.push(newVal);
        transactions.value.set(currentGroup, currentVal);
      } else {
        transactions.value.set(currentGroup, new Array(newVal));
      }
    }

    console.log(transactions.value);

    groups.value = await getApiGroups(user.selectedOrganization.serverUrl, network.network);
  } finally {
    isLoading.value = false;
  }
}

function getOpositeDirection() {
  return sort.direction === 'asc' ? 'desc' : 'asc';
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
</script>

<template>
  <div class="fill-remaining overflow-x-auto">
    <template v-if="isLoading">
      <AppLoader class="h-100" />
    </template>
    <template v-else>
      <template v-if="transactions.size > 0">
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
            <template v-for="group of transactions" :key="group[0]">
              <tr>
                <template v-if="group[0] != -1">
                  <td>
                    {{ group[0] }}
                  </td>
                  <td>{{ groups[group[0] - 1].description }}</td>
                  <td>
                    {{
                      group[1][0].transaction instanceof Transaction
                        ? getTransactionDateExtended(group[1][0].transaction)
                        : 'N/A'
                    }}
                  </td>
                  <td class="text-center">
                    <AppButton @click="handleGroupDetails(group[0])" color="secondary"
                      >Sign</AppButton
                    >
                  </td>
                </template>

                <template v-else>
                  <template v-for="tx of group[1]" :key="tx.transactionRaw.id">
                    <td>
                      {{
                        tx.transaction instanceof Transaction
                          ? getTransactionId(tx.transaction)
                          : 'N/A'
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
                      <AppButton @click="handleDetails(tx.transactionRaw.id)" color="secondary"
                        >Sign</AppButton
                      >
                    </td>
                  </template>
                </template>
              </tr>
            </template>

            <!-- <template v-for="tx in transactions" :key="tx.transactionRaw.id">
              <tr>
                <td :data-testid="`td-transaction-id-in-progress-${index}`">
                  {{
                    tx.transaction instanceof Transaction ? getTransactionId(tx.transaction) : 'N/A'
                  }}
                </td>
                <td :data-testid="`td-transaction-type-in-progress-${index}`">
                  <span class="text-bold">{{
                    tx.transaction instanceof Transaction
                      ? getTransactionType(tx.transaction)
                      : 'N/A'
                  }}</span>
                </td>
                <td :data-testid="`td-transaction-valid-start-in-progress-${index}`">
                  {{
                    tx.transaction instanceof Transaction
                      ? getTransactionDateExtended(tx.transaction)
                      : 'N/A'
                  }}
                </td>
                <td class="text-center">
                  <AppButton
                    @click="handleDetails(tx.transactionRaw.id)"
                    :data-testid="`button-transaction-in-progress-details-${index}`"
                    color="secondary"
                    class="min-w-unset"
                    >Details</AppButton
                  >
                </td>
              </tr>
            </template> -->
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
