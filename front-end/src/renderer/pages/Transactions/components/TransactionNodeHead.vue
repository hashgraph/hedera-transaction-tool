<script setup lang="ts">
import { computed, ref } from 'vue';
import { type ITransactionNode } from '../../../../../../middle-end/src/ITransactionNode.ts';

type ITransactionNodeSort = {
  field: keyof ITransactionNode;
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

const handleSort = async (field: keyof ITransactionNode, direction: 'asc' | 'desc') => {
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
          handleSort('transactionId', sort?.field === 'transactionId' ? oppositeDirection : 'asc')
        "
      >
        <span>Transaction ID</span>
        <i
          v-if="sort?.field === 'transactionId'"
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
            'transactionType',
            sort?.field === 'transactionType' ? oppositeDirection : 'asc',
          )
        "
      >
        <span>Transaction Type</span>
        <i
          v-if="sort?.field === 'transactionType'"
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
          handleSort('description', sort?.field === 'description' ? oppositeDirection : 'asc')
        "
      >
        <span>Description</span>
        <i v-if="sort?.field === 'description'" :class="[generatedClass]" class="bi text-title"></i>
      </div>
    </th>

    <!-- Header #4 -->
    <th @contextmenu.prevent="showContextMenu">
      <div
        class="table-sort-link"
        @click="handleSort('validStart', sort?.field === 'validStart' ? oppositeDirection : 'asc')"
      >
        <span>Valid Start</span>
        <i v-if="sort?.field === 'validStart'" class="bi text-title" :class="[generatedClass]"></i>
      </div>
    </th>

    <!-- Header #5 -->
    <th class="text-center">
      <span>Actions</span>
    </th>
  </tr>
</template>
