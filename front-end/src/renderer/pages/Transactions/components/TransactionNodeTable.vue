<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from 'vue-toast-notification';

import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '../../../../../../shared/src/ITransactionNode.ts';

import { BackEndTransactionType, NotificationType, TransactionStatus } from '@shared/interfaces';

import useUserStore from '@renderer/stores/storeUser.ts';
import useNetworkStore from '@renderer/stores/storeNetwork.ts';
import useNextTransactionStore from '@renderer/stores/storeNextTransaction';

import useMarkNotifications from '@renderer/composables/useMarkNotifications';
import useWebsocketSubscription from '@renderer/composables/useWebsocketSubscription';

import AppLoader from '@renderer/components/ui/AppLoader.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import TransactionNodeHead from '@renderer/pages/Transactions/components/TransactionNodeHead.vue';
import TransactionNodeRow from '@renderer/pages/Transactions/components/TransactionNodeRow.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import { getTransactionNodes } from '@renderer/services/organization/transactionNode.ts';
import { isLoggedInOrganization } from '@renderer/utils';
import { errorToastOptions } from '@renderer/utils/toastOptions.ts';
import {
  sortTransactionNodes,
  TransactionNodeSortField,
} from '@renderer/utils/sortTransactionNodes.ts';
import TransactionsFilterV2 from '@renderer/components/Filter/v2/TransactionsFilterV2.vue';
import { TRANSACTION_ACTION } from '@shared/constants';

const NOTIFICATION_TYPES_BY_COLLECTION: Record<
  TransactionNodeCollection,
  NotificationType[]
> = {
  [TransactionNodeCollection.READY_FOR_REVIEW]: [],
  [TransactionNodeCollection.READY_TO_SIGN]: [],
  [TransactionNodeCollection.IN_PROGRESS]: [],
  [TransactionNodeCollection.READY_FOR_EXECUTION]: [
    NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
  ],

  [TransactionNodeCollection.HISTORY]: [
    NotificationType.TRANSACTION_INDICATOR_EXECUTED,
    NotificationType.TRANSACTION_INDICATOR_EXPIRED,
    NotificationType.TRANSACTION_INDICATOR_ARCHIVED,
    NotificationType.TRANSACTION_INDICATOR_CANCELLED,
    NotificationType.TRANSACTION_INDICATOR_FAILED,
  ],
};

/* Props */
const props = defineProps<{
  collection: TransactionNodeCollection;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'nodesFetched', value: ITransactionNode[]): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const nextTransaction = useNextTransactionStore();

/* Composables */
const toast = useToast();
useWebsocketSubscription(TRANSACTION_ACTION, fetchNodes);
/* Use mark notifications with computed types */
const { oldNotifications } = useMarkNotifications(
  NOTIFICATION_TYPES_BY_COLLECTION[props.collection] ?? [],
);

/* State */
const nodes = ref<ITransactionNode[]>([]);
const isLoading = ref(true);
const sort = ref<{
  field: TransactionNodeSortField;
  direction: 'asc' | 'desc';
}>(initialSort());
const currentPage = ref(1);
const pageSize = ref(10);
const statusFilter = ref<TransactionStatus[]>([]);
const transactionTypeFilter = ref<BackEndTransactionType[]>([]);

/* Computed */
const pageItems = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value;
  const endIndex = startIndex + pageSize.value;
  return nodes.value.slice(startIndex, endIndex);
});

const loadErrorMessage = computed(() => {
  let result: string;
  switch (props.collection) {
    case TransactionNodeCollection.HISTORY:
      result = 'Failed to load transactions and groups in History';
      break;
    case TransactionNodeCollection.IN_PROGRESS:
      result = 'Failed to load transactions and groups in progress';
      break;
    case TransactionNodeCollection.READY_TO_SIGN:
      result = 'Failed to load transactions and groups ready to sign';
      break;
    case TransactionNodeCollection.READY_FOR_EXECUTION:
      result = 'Failed to load transactions and groups ready for execution';
      break;
    case TransactionNodeCollection.READY_FOR_REVIEW:
      result = 'Failed to load transactions and groups for review';
      break;
  }
  return result;
});

/* Functions */
function initialSort() {
  let result: {
    field: TransactionNodeSortField;
    direction: 'asc' | 'desc';
  };
  switch (props.collection) {
    case TransactionNodeCollection.READY_FOR_REVIEW:
    case TransactionNodeCollection.READY_TO_SIGN:
    case TransactionNodeCollection.READY_FOR_EXECUTION:
    case TransactionNodeCollection.IN_PROGRESS:
      result = {
        field: TransactionNodeSortField.VALID_START_DATE,
        direction: 'asc',
      };
      break;
    case TransactionNodeCollection.HISTORY:
      result = {
        field: TransactionNodeSortField.CREATED_AT_DATE,
        direction: 'desc',
      };
      break;
  }
  return result;
}

async function fetchNodes(): Promise<void> {
  if (isLoggedInOrganization(user.selectedOrganization)) {
    isLoading.value = true;
    try {
      nodes.value = await getTransactionNodes(
        user.selectedOrganization.serverUrl,
        props.collection,
        network.network,
        statusFilter.value,
        transactionTypeFilter.value,
      );
      resetPagination();
      sortNodes();
    } catch {
      toast.error(loadErrorMessage.value, errorToastOptions);
    } finally {
      isLoading.value = false;
    }
  } else {
    nodes.value = [];
  }
  emit('nodesFetched', nodes.value);
}

function sortNodes(): void {
  sortTransactionNodes(nodes.value, sort.value.field);
  if (sort.value.direction === 'desc') {
    nodes.value.reverse();
  }
}

function resetPagination(): void {
  currentPage.value = 1;
}

function setGetTransactionsFunction(): void {
  nextTransaction.setGetTransactionsFunction(async () => {
    if (isLoggedInOrganization(user.selectedOrganization)) {
      try {
        const allNodes = await getTransactionNodes(
          user.selectedOrganization.serverUrl,
          props.collection,
          network.network,
          statusFilter.value,
          transactionTypeFilter.value,
        );
        const transactionIds = allNodes
          .filter((node): node is ITransactionNode & { transactionId: number } =>
            node.transactionId !== undefined)
          .map(node => node.transactionId);
        return { items: transactionIds, totalItems: transactionIds.length };
      } catch {
        return { items: [], totalItems: 0 };
      }
    }
    return { items: [], totalItems: 0 };
  }, false);
}

function handleBeforeNavigateToDetails(transactionId: number): void {
  const selectedIndex = nodes.value.findIndex(n => n.transactionId === transactionId);
  if (selectedIndex >= 0) {
    const previousIds = nodes.value
      .slice(0, selectedIndex)
      .filter((n): n is ITransactionNode & { transactionId: number } =>
        n.transactionId !== undefined)
      .map(n => n.transactionId);
    nextTransaction.setPreviousTransactionsIds(previousIds);
  }
}

/* Watchers */
watch(sort, () => {
    resetPagination();
    sortNodes();
  },
);

watch([statusFilter, transactionTypeFilter], () => {
  setGetTransactionsFunction();
  fetchNodes();
}, { deep: true });

onMounted(() => {
  setGetTransactionsFunction();
  fetchNodes();
});
</script>

<template>
  <div class="fill-remaining overflow-x-auto">
    <div v-if="props.collection === TransactionNodeCollection.HISTORY" class="mt-3 mb-3">
      <TransactionsFilterV2
        v-model:status-filter="statusFilter"
        v-model:transaction-type-filter="transactionTypeFilter"
      />
    </div>
    <template v-if="isLoading">
      <AppLoader class="h-100" />
    </template>
    <template v-else>
      <template v-if="nodes.length > 0">
        <table class="table-custom">
          <thead>
            <TransactionNodeHead v-model:sort="sort" :collection="props.collection" />
          </thead>
          <tbody>
            <template v-for="(node, index) of pageItems" :key="index">
              <TransactionNodeRow
                :collection="props.collection"
                :node="node"
                :index="index"
                :old-notifications="oldNotifications"
                @transaction-signed="fetchNodes"
                @transaction-group-signed="fetchNodes"
                @before-navigate-to-details="handleBeforeNavigateToDetails"
              />
            </template>
          </tbody>
          <tfoot class="d-table-caption">
            <tr class="d-inline">
              <AppPager
                v-model:current-page="currentPage"
                v-model:per-page="pageSize"
                :total-items="nodes.length"
              />
            </tr>
          </tfoot>
        </table>
      </template>
      <template v-else>
        <div class="flex-column-100 flex-centered">
          <EmptyTransactions mode="transactions-tab" />
        </div>
      </template>
    </template>
  </div>
</template>
