<script setup lang="ts">
import type { ITransaction } from '@shared/interfaces';

import { computed, onBeforeMount, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

import { Transaction } from '@hashgraph/sdk';

import { NotificationType } from '@shared/interfaces';
import { TRANSACTION_ACTION } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useNotificationsStore from '@renderer/stores/storeNotifications';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useNextTransactionStore from '@renderer/stores/storeNextTransaction';

import { useRouter } from 'vue-router';
import useDisposableWs from '@renderer/composables/useDisposableWs';
import useMarkNotifications from '@renderer/composables/useMarkNotifications';

import {
  getApiGroupById,
  getTransactionsToApprove,
  type IGroup,
} from '@renderer/services/organization';

import {
  getNotifiedTransactions,
  hexToUint8Array,
  redirectToDetails,
  redirectToGroupDetails,
  isLoggedInOrganization,
} from '@renderer/utils';
import {
  getTransactionType,
  getTransactionValidStart,
} from '@renderer/utils/sdk/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import DateTimeString from '@renderer/components/ui/DateTimeString.vue';
import TransactionId from '@renderer/components/ui/TransactionId.vue';

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
const groups = ref<Map<number, IGroup>>(new Map());
const notifiedTransactionIds = ref<number[]>([]);
const totalItems = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const isLoading = ref(true);
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);

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
//     toast.success('Transactions signed successfully', successToastOptions);
//   } catch {
//     toast.error('Transactions not approved', errorToastOptions);
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
      const fetchedGroups: Map<number, IGroup> = new Map();
      for (const id of groupIds) {
        if (user.selectedOrganization?.serverUrl) {
          const group = await getApiGroupById(user.selectedOrganization.serverUrl, id);
          fetchedGroups.set(id, group);
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

const showContextMenu = (event: MouseEvent) => {
  contextMenuVisible.value = true;
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
};

const hideContextMenu = () => {
  contextMenuVisible.value = false;
};

/* Hooks */
onBeforeMount(async () => {
  subscribeToTransactionAction();
  setGetTransactionsFunction();
  await fetchTransactions();
});

onMounted(() => {
  document.addEventListener('click', hideContextMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu);
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
              <th @contextmenu.prevent="showContextMenu">
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
              <th @contextmenu.prevent="showContextMenu">
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
              <th @contextmenu.prevent="showContextMenu">
                <div
                  class="table-sort-link"
                  @click="handleSort('description', sort.field === 'description' ? getOppositeDirection() : 'asc')"
                >
                  <span>Description</span>
                  <i
                    v-if="sort.field === 'description'"
                    class="bi text-title"
                    :class="[generatedClass]"
                  ></i>
                </div>
              </th>
              <th @contextmenu.prevent="showContextMenu">
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
<!--
              <th @contextmenu.prevent="showContextMenu">
                <div
                  class="table-sort-link"
                  @click="
                    handleSort(
                      'updatedAt',
                      sort.field === 'updatedAt' ? getOppositeDirection() : 'asc',
                    )
                  "
                >
                  <span>Date Modified</span>
                  <i
                    v-if="sort.field === 'updatedAt'"
                    class="bi text-title"
                    :class="[generatedClass]"
                  ></i>
                </div>
              </th>
-->
              <th class="text-center">
                <span>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="[groupId, groupTransactions] of transactions" :key="groupId">
              <template v-if="groupId != -1">
                <tr>
                  <td>
                    <i class="bi bi-stack" />
                  </td>
                  <td>Group</td>
                  <td>{{ groups.get(groupId)?.description }}</td>
                  <td>
                    <DateTimeString
                      v-if="groupTransactions[0].transaction instanceof Transaction"
                      :date="getTransactionValidStart(groupTransactions[0].transaction)"
                      compact
                      wrap
                    />
                    <span v-else>N/A</span>
                  </td>
<!--
                  <td>
                    <DateTimeString
                      v-if="groups.get(groupId)"
                      :date="getTransactionGroupUpdatedAt(groups.get(groupId)!)"
                      compact
                      wrap
                    />
                    <span v-else>N/A</span>
                  </td>
-->
                  <td class="text-center">
                    <AppButton
                      @click="redirectToGroupDetails($router, groupId)"
                      color="secondary"
                      >Details</AppButton
                    >
                  </td>
                </tr>
              </template>

              <template v-else>
                <template v-for="(tx, index) in groupTransactions" :key="tx.transactionRaw.id">
                  <tr :class="{ highlight: notifiedTransactionIds.includes(tx.transactionRaw.id) }">
                    <td :data-testid="`td-review-transaction-id-${index}`">
                      <TransactionId
                        v-if="tx.transaction instanceof Transaction"
                        :transaction-id="tx.transaction.transactionId"
                        wrap
                      />
                      <span v-else>N/A</span>
                    </td>
                    <td :data-testid="`td-review-transaction-type-${index}`">
                      <span class="text-bold">{{
                          tx.transaction instanceof Transaction
                            ? getTransactionType(tx.transaction, false, true)
                            : 'N/A'
                        }}</span>
                    </td>
                    <td :data-testid="`td-review-transaction-description-${index}`">
                      <span class="text-wrap-two-line-ellipsis">{{
                          tx.transaction instanceof Transaction
                            ? tx.transactionRaw.description
                            : 'N/A'
                        }}</span>
                    </td>
                    <td :data-testid="`td-review-transaction-valid-start-${index}`">
                      <DateTimeString
                        v-if="tx.transaction instanceof Transaction"
                        :date="getTransactionValidStart(tx.transaction)"
                        compact
                        wrap
                      />
                      <span v-else>N/A</span>
                    </td>
<!--
                    <td :data-testid="`td-review-transaction-date-modified-${index}`">
                      <DateTimeString
                        v-if="tx.transaction instanceof Transaction"
                        :date="new Date(tx.transactionRaw.updatedAt)"
                        compact
                        wrap
                      />
                      <span v-else>N/A</span>
                    </td>
-->
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
        <!-- Context menu -->
        <div
          v-if="contextMenuVisible"
          class="dropdown"
          :style="{ position: 'fixed', top: contextMenuY + 'px', left: contextMenuX + 'px', zIndex: 1000 }"
          @click.stop
        >
          <ul class="dropdown-menu show mt-3">
            <li class="dropdown-item cursor-pointer" @click="handleSort('createdAt', 'desc'); hideContextMenu()">Sort by Newest</li>
            <li class="dropdown-item cursor-pointer" @click="handleSort('createdAt', 'asc'); hideContextMenu()">Sort by Oldest</li>
          </ul>
        </div>
      </template>
      <template v-else>
        <div class="flex-column-100 flex-centered">
          <EmptyTransactions :mode="'transactions-tab'" />
        </div>
      </template>
    </template>
  </div>
</template>
