<script setup lang="ts">
import type { IGroup, ITransaction } from '@main/shared/interfaces';

import { computed, onBeforeMount, reactive, ref, watch } from 'vue';

import { Transaction } from '@hashgraph/sdk';

import { NotificationType } from '@main/shared/interfaces';
import { TRANSACTION_ACTION } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useNotificationsStore from '@renderer/stores/storeNotifications';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useNextTransactionStore from '@renderer/stores/storeNextTransaction';

import { useRouter } from 'vue-router';
import useDisposableWs from '@renderer/composables/useDisposableWs';
import useMarkNotifications from '@renderer/composables/useMarkNotifications';

import { getApiGroupById, getTransactionsToApprove } from '@renderer/services/organization';

import {
  getNotifiedTransactions,
  hexToUint8Array,
  redirectToDetails,
  redirectToGroupDetails,
  isLoggedInOrganization,
} from '@renderer/utils';
import {
  getTransactionDateExtended,
  getTransactionId,
  getTransactionType,
} from '@renderer/utils/sdk/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const notifications = useNotificationsStore();
const wsStore = useWebsocketConnection();
const nextTransaction = useNextTransactionStore();

/* Composables */
const router = useRouter();
const ws = useDisposableWs();
const { oldNotifications } = useMarkNotifications([NotificationType.TRANSACTION_INDICATOR_APPROVE]);

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
const groups = ref<IGroup[]>([]);
const notifiedTransactionIds = ref<number[]>([]);
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
const handleApprove = async (id: number) => {
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

// const handleDetails = async (id: number) => {
//   try {
//     if (transactions.value.get(id) != undefined) {
//       const txs = transactions.value.get(id);
//       if (txs != undefined) {
//         if (!txs[0].transaction || !(txs[0].transaction instanceof Transaction)) {
//           throw new Error('Transaction not provided');
//         }

//         for (const transaction of txs) {
//           tx.value = transaction;

//           await handleApproveSingle();
//         }
//       }
//     }
//     toast.success('Transactions signed successfully');
//   } catch {
//     toast.error('Transactions not approved');
//   }
// };

const handleSort = async (field: keyof ITransaction, direction: 'asc' | 'desc') => {
  sort.field = field;
  sort.direction = direction;
  setGetTransactionsFunction();
  await fetchTransactions();
};

/* Functions */
function setNotifiedTransactions() {
  const flatTransactions = [...transactions.value.values()].flat();
  const notificationsKey = user.selectedOrganization?.serverUrl || '';

  notifiedTransactionIds.value = getNotifiedTransactions(
    notifications.notifications[notificationsKey]?.concat(oldNotifications.value) || [],
    flatTransactions.map(t => t.transactionRaw),
    [NotificationType.TRANSACTION_INDICATOR_APPROVE],
  );
}

async function fetchTransactions() {
  transactions.value = new Map();
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    notifiedTransactionIds.value = [];
    return;
  }

  if (user.selectedOrganization.isPasswordTemporary) return;

  isLoading.value = true;
  try {
    const { totalItems: totalItemsCount, items: rawTransactions } = await getTransactionsToApprove(
      user.selectedOrganization.serverUrl,
      network.network,
      currentPage.value,
      pageSize.value,
      [{ property: sort.field, direction: sort.direction }],
    );
    totalItems.value = totalItemsCount;

    const transactionsBytes = rawTransactions.map(t => hexToUint8Array(t.transactionBytes));

    const groupIds: number[] = [];

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

      if (transaction.groupItem?.groupId && !groupIds.includes(transaction.groupItem?.groupId)) {
      groupIds.push(transaction.groupItem.groupId);
      }
    }

    setNotifiedTransactions();

    if (groupIds.length > 0) {
      const fetchedGroups: IGroup[] = [];
      for (const id of groupIds) {
        if (user.selectedOrganization?.serverUrl) {
          const group = await getApiGroupById(user.selectedOrganization.serverUrl, id);
          fetchedGroups.push(group);
        }
      }
      groups.value = fetchedGroups;
    }
  } finally {
    isLoading.value = false;
  }
}

function setGetTransactionsFunction() {
  nextTransaction.setGetTransactionsFunction(async (page: number | null, size: number | null) => {
    if (!isLoggedInOrganization(user.selectedOrganization))
      throw new Error('User not logged in organization');

    const { items, totalItems } = await getTransactionsToApprove(
      user.selectedOrganization.serverUrl,
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

function getOppositeDirection() {
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

watch(
  () => notifications.notifications,
  () => {
    setNotifiedTransactions();
  },
);
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
                      sort.field === 'transactionId' ? getOppositeDirection() : 'asc',
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
                  @click="handleSort('type', sort.field === 'type' ? getOppositeDirection() : 'asc')"
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
                      sort.field === 'validStart' ? getOppositeDirection() : 'asc',
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
                  <td>{{ groups[group[0] - 1]?.description || groups.find((g: Record<any, any>) => g.id === group[0])?.description }}</td>
                  <td>
                    {{
                      group[1][0].transaction instanceof Transaction
                        ? getTransactionDateExtended(group[1][0].transaction)
                        : 'N/A'
                    }}
                  </td>
                  <td class="text-center">
                    <AppButton
                      @click="redirectToGroupDetails($router, group[0])"
                      color="secondary"
                      class="min-w-unset"
                      >Details</AppButton
                    >
                  </td>
                </tr>
              </template>

              <template v-else>
                <template v-for="(tx, index) in group[1]" :key="tx.transactionRaw.id">
                  <tr :class="{ highlight: notifiedTransactionIds.includes(tx.transactionRaw.id) }">
                    <td :data-testid="`td-review-transaction-id-${index}`">
                      {{
                        tx.transaction instanceof Transaction
                          ? getTransactionId(tx.transaction)
                          : 'N/A'
                      }}
                    </td>
                    <td :data-testid="`td-review-transaction-type-${index}`">
                      <span class="text-bold">{{
                        tx.transaction instanceof Transaction
                          ? getTransactionType(tx.transaction)
                          : 'N/A'
                      }}</span>
                    </td>
                    <td :data-testid="`td-review-transaction-valid-start-${index}`">
                      {{
                        tx.transaction instanceof Transaction
                          ? getTransactionDateExtended(tx.transaction)
                          : 'N/A'
                      }}
                    </td>
                    <td class="text-center">
                      <AppButton
                        @click="handleApprove(tx.transactionRaw.id)"
                        :data-testid="`button-review-transaction-approve-${index}`"
                        color="secondary"
                        >Submit Approval</AppButton
                      >
                    </td>
                  </tr>
                </template>
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
