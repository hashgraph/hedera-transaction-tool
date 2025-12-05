<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import TransactionNodeHead from '@renderer/pages/Transactions/components/TransactionNodeHead.vue';
import TransactionNodeRow from '@renderer/pages/Transactions/components/TransactionNodeRow.vue';
import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '../../../../../../middle-end/src/ITransactionNode.ts';
import AppPager from '@renderer/components/ui/AppPager.vue';
import { getTransactionNodes } from '@renderer/services/organization/transactionNode.ts';
import useUserStore from '@renderer/stores/storeUser.ts';
import { isLoggedInOrganization } from '@renderer/utils';
import { errorToastOptions } from '@renderer/utils/toastOptions.ts';
import { useToast } from 'vue-toast-notification';
import {
  sortTransactionNodes,
  TransactionNodeSortField,
} from '@renderer/utils/sortTransactionNodes.ts';

/* Props */
const props = defineProps<{
  collection: TransactionNodeCollection;
}>();

/* Stores */
const user = useUserStore();
const toast = useToast();

/* State */
const nodes = ref<ITransactionNode[]>([]);
const isLoading = ref(true);
const sort = ref<{
  field: TransactionNodeSortField;
  direction: 'asc' | 'desc';
}>(initialSort());
const currentPage = ref(1);
const pageSize = ref(10);

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
      );
      sortNodes();
    } catch {
      toast.error(loadErrorMessage.value, errorToastOptions);
    } finally {
      isLoading.value = false;
    }
  } else {
    nodes.value = [];
  }
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

/* Watchers */
watch(
  sort,
  async () => {
    resetPagination();
    sortNodes();
  },
  { immediate: true },
);

onMounted(fetchNodes);
</script>

<template>
  <div class="fill-remaining overflow-x-auto">
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
                @transaction-signed="fetchNodes"
                @transaction-group-signed="fetchNodes"
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
