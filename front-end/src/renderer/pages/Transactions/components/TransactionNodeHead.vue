<script setup lang="ts">
import { computed, ref } from 'vue';
import { TransactionNodeSortField } from '@renderer/utils/sortTransactionNodes.ts';

type ITransactionNodeSort = {
  field: TransactionNodeSortField;
  direction: 'asc' | 'desc';
};

/* Props */
const sort = defineModel<ITransactionNodeSort>('sort');

/* State */
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);

/* Computed */
const oppositeDirection = computed(() => {
  return sort.value?.direction === 'asc' ? 'desc' : 'asc';
});
const generatedClass = computed(() => {
  return sort.value?.direction === 'desc' ? 'bi-arrow-down-short' : 'bi-arrow-up-short';
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
    <!-- Header #1 -->
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

    <!-- Header #2 -->
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

    <!-- Header #3 -->
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

    <!-- Header #4 -->
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

    <!-- Header #5 -->
    <th class="text-center">
      <span>Actions</span>
    </th>
  </tr>
</template>
