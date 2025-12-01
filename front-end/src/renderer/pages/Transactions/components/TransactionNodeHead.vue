<script setup lang="ts">
import { computed, ref } from 'vue';
import { TransactionNodeSortField } from '@renderer/utils/sortTransactionNodes.ts';
import { TransactionNodeCollection } from '../../../../../../middle-end/src/ITransactionNode.ts';

type ITransactionNodeSort = {
  field: TransactionNodeSortField;
  direction: 'asc' | 'desc';
};

/* Props */
const props = defineProps<{
  collection: TransactionNodeCollection;
}>();

/* Models */
const sort = defineModel<ITransactionNodeSort>('sort', { required: true });

/* State */
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);

/* Computed */
const oppositeDirection = computed(() => {
  return sort.value.direction === 'asc' ? 'desc' : 'asc';
});
const generatedClass = computed(() => {
  return sort.value.direction === 'desc' ? 'bi-arrow-down-short' : 'bi-arrow-up-short';
});

/* Handlers */
const showContextMenu = (event: MouseEvent) => {
  contextMenuVisible.value = true;
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
};

const handleSort = async (field: TransactionNodeSortField, direction: 'asc' | 'desc') => {
  sort.value = { field, direction };
};
</script>

<template>
  <tr>
    <!-- Header #1 : Transaction Id -->
    <th @contextmenu.prevent="showContextMenu">
      <div
        class="table-sort-link"
        @click="
          handleSort(
            TransactionNodeSortField.TRANSACTION_ID,
            sort?.field === TransactionNodeSortField.TRANSACTION_ID ? oppositeDirection : 'asc',
          )
        "
      >
        <span>Transaction ID</span>
        <i
          v-if="sort?.field === TransactionNodeSortField.TRANSACTION_ID"
          class="bi text-title"
          :class="[generatedClass]"
        ></i>
      </div>
    </th>

    <!-- Header #2 : Transaction Type / Group -->
    <th @contextmenu.prevent="showContextMenu">
      <div
        class="table-sort-link"
        @click="
          handleSort(
            TransactionNodeSortField.TRANSACTION_TYPE,
            sort?.field === TransactionNodeSortField.TRANSACTION_TYPE ? oppositeDirection : 'asc',
          )
        "
      >
        <span>Transaction Type</span>
        <i
          v-if="sort?.field === TransactionNodeSortField.TRANSACTION_TYPE"
          class="bi text-title"
          :class="[generatedClass]"
        ></i>
      </div>
    </th>

    <template v-if="props.collection === TransactionNodeCollection.HISTORY">

      <!-- Header #3 : Status -->
      <th @contextmenu.prevent="showContextMenu">
        <div
          class="table-sort-link"
          @click="
          handleSort(
            TransactionNodeSortField.STATUS,
            sort?.field === TransactionNodeSortField.STATUS ? oppositeDirection : 'asc',
          )
        "
        >
          <span>Status</span>
          <i
            v-if="sort?.field === TransactionNodeSortField.STATUS"
            :class="[generatedClass]"
            class="bi text-title"
          ></i>
        </div>
      </th>

      <!-- Header #4 : Created At-->
      <th @contextmenu.prevent="showContextMenu">
        <div
          class="table-sort-link"
          @click="
            handleSort(
              TransactionNodeSortField.CREATED_AT_DATE,
              sort?.field === TransactionNodeSortField.CREATED_AT_DATE ? oppositeDirection : 'asc',
            )
          "
        >
          <span>Created At</span>
          <i
            v-if="sort?.field === TransactionNodeSortField.CREATED_AT_DATE"
            class="bi text-title"
            :class="[generatedClass]"
          ></i>
        </div>
      </th>

      <!-- Header #5 : Executed At-->
      <th @contextmenu.prevent="showContextMenu">
        <div
          class="table-sort-link"
          @click="
            handleSort(
              TransactionNodeSortField.EXECUTED_AT_DATE,
              sort?.field === TransactionNodeSortField.EXECUTED_AT_DATE ? oppositeDirection : 'asc',
            )
          "
        >
          <span>Executed At</span>
          <i
            v-if="sort?.field === TransactionNodeSortField.EXECUTED_AT_DATE"
            class="bi text-title"
            :class="[generatedClass]"
          ></i>
        </div>
      </th>
    </template>

    <template v-else>

      <!-- Header #3 : Description -->
      <th @contextmenu.prevent="showContextMenu">
        <div
          class="table-sort-link"
          @click="
          handleSort(
            TransactionNodeSortField.DESCRIPTION,
            sort?.field === TransactionNodeSortField.DESCRIPTION ? oppositeDirection : 'asc',
          )
        "
        >
          <span>Description</span>
          <i
            v-if="sort?.field === TransactionNodeSortField.DESCRIPTION"
            :class="[generatedClass]"
            class="bi text-title"
          ></i>
        </div>
      </th>

      <!-- Header #4 : Valid Start -->
      <th @contextmenu.prevent="showContextMenu">
        <div
          class="table-sort-link"
          @click="
            handleSort(
              TransactionNodeSortField.VALID_START_DATE,
              sort?.field === TransactionNodeSortField.VALID_START_DATE ? oppositeDirection : 'asc',
            )
          "
        >
          <span>Valid Start</span>
          <i
            v-if="sort?.field === TransactionNodeSortField.VALID_START_DATE"
            class="bi text-title"
            :class="[generatedClass]"
          ></i>
        </div>
      </th>
    </template>

    <!-- Header #5 : Actions -->
    <th class="text-center">
      <span>Actions</span>
    </th>
  </tr>
</template>
