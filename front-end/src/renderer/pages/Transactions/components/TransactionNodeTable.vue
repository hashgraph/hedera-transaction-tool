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
  field: keyof ITransactionNode;
  direction: 'asc' | 'desc';
}>({
  field: 'validStart',
  direction: 'desc',
});
const totalItems = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);

/* Computed */
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
async function updateNodes(): Promise<void> {
  if (isLoggedInOrganization(user.selectedOrganization)) {
    isLoading.value = true;
    try {
      const r = await getTransactionNodes(
        user.selectedOrganization.serverUrl,
        props.collection,
        currentPage.value,
        pageSize.value,
      );
      nodes.value = r.items;
      totalItems.value = r.totalItems;
    } catch {
      toast.error(loadErrorMessage.value, errorToastOptions);
    } finally {
      isLoading.value = false;
    }
  } else {
    nodes.value = [];
    totalItems.value = 0;
  }
}

function resetPagination(): void {
  currentPage.value = 1;
}

/* Watchers */
watch(sort, async () => {
  resetPagination();
  await updateNodes();
});

onMounted(updateNodes);
</script>

<template>
  <div class="fill-remaining overflow-x-auto">
    <template v-if="nodes === null">
      <AppLoader class="h-100" />
    </template>
    <template v-else>
      <template v-if="totalItems > 0">
        <table class="table-custom">
          <thead>
            <TransactionNodeHead v-model:sort="sort" :collection="props.collection" />
          </thead>
          <tbody>
            <template v-for="(node, index) of nodes" :key="index">
              <TransactionNodeRow :collection="props.collection" :node="node" :index="index" />
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
          <EmptyTransactions mode="transactions-tab" />
        </div>
      </template>
    </template>
  </div>
</template>
