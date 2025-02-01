<script setup lang="ts">
import type { ITransaction } from '@main/shared/interfaces';

import { computed, onBeforeMount, reactive, ref, watch, watchEffect } from 'vue';

import { Transaction } from '@hashgraph/sdk';

import { TransactionStatus } from '@main/shared/interfaces';
import { TRANSACTION_ACTION } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useNextTransactionStore from '@renderer/stores/storeNextTransaction';

import { useRouter } from 'vue-router';
import useDisposableWs from '@renderer/composables/useDisposableWs';

import { getApiGroups, getTransactionsForUser } from '@renderer/services/organization';

import {
  getTransactionDateExtended,
  getTransactionId,
  getTransactionType,
} from '@renderer/utils/sdk/transactions';
import {
  redirectToDetails,
  redirectToGroupDetails,
  isLoggedInOrganization,
  hexToUint8Array,
  countWaitingForSignatures,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const wsStore = useWebsocketConnection();
const nextTransaction = useNextTransactionStore();

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

const waitingForSignaturesCounts = computed(() => {
  const counts: Record<number, number> = {};
  transactions.value.forEach((txList, groupId) => {
    if (groupId !== -1) {
      counts[groupId] = countWaitingForSignatures(transactions.value, groupId);
    }
  });
  return counts;
});

/* Handlers */
const handleDetails = async (id: number) => {
  const flatTransactions = Array.from(transactions.value)
    .map(e => e[1])
    .flat();
  const selectedTransactionIndex = flatTransactions.findIndex(t => t.transactionRaw.id === id);
  const previousTransactionIds = flatTransactions
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
async function fetchTransactions() {
  transactions.value = new Map();
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
    totalItems.value = totalItemsCount;
    const transactionsBytes = rawTransactions.map(t => hexToUint8Array(t.transactionBytes));

    for (const [i, transaction] of rawTransactions.entries()) {
      const currentGroup =
        transaction.groupItem?.groupId != null ? transaction.groupItem.groupId : -1;
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

    groups.value = await getApiGroups(user.selectedOrganization.serverUrl);
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

watchEffect(() => {
  console.log(waitingForSignaturesCounts.value);
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
              <template v-if="group[0] != -1">
                <tr>
                  <td>
                    <i class="bi bi-stack" />
                  </td>
                  <td>{{ groups[group[0] - 1]?.description }}</td>
                  <td>
                    {{
                      group[1][0].transaction instanceof Transaction
                        ? getTransactionDateExtended(group[1][0].transaction)
                        : 'N/A'
                    }}
                  </td>
                  <td class="text-center">
                    <AppButton @click="redirectToGroupDetails($router, group[0])" color="secondary"
                      ><span
                        :class="
                          waitingForSignaturesCounts[group[0]] &&
                          'signature-notification position-relative'
                        "
                        :data-notification="waitingForSignaturesCounts[group[0]]"
                      >
                        Details
                      </span></AppButton
                    >
                  </td>
                </tr>
              </template>

              <template v-else>
                <template v-for="(tx, index) of group[1]" :key="tx.transactionRaw.id">
                  <tr>
                    <td :data-testid="`td-transaction-id-in-progress-${index}`">
                      {{
                        tx.transaction instanceof Transaction
                          ? getTransactionId(tx.transaction)
                          : 'N/A'
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
                        >Details</AppButton
                      >
                    </td>
                  </tr>
                </template>
              </template>
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
        <div class="flex-column-100 flex-centered">
          <EmptyTransactions :mode="'transactions-tab'" />
        </div>
      </template>
    </template>
  </div>
</template>
