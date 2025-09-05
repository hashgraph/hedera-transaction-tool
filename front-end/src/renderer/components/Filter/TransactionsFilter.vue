<script setup lang="ts">
import type { ITransaction } from '@shared/interfaces';

import TransactionsFilterDropDown from '@renderer/components/Filter/TransactionsFilterDropDown.vue';
import FilterFields from '@renderer/components/Filter/FilterFields.vue';

/* Props */
defineProps<{
  filters: {
    property: keyof ITransaction;
    rule: string;
    value: string | string[];
  }[];
  inline?: boolean;
  togglerClass?: string;
  history?: boolean;
  hide?: (keyof ITransaction)[];
}>();

/* Emits */
defineEmits(['update:filters']);
</script>
<template>
  <template v-if="inline">
    <div class="d-flex flex-wrap gap-4 text-small">
      <FilterFields
        :filters="filters"
        @update:filters="$emit('update:filters', $event)"
        :inline="true"
        :history="history"
        :hide="hide"
      />
    </div>
  </template>
  <template v-else>
    <TransactionsFilterDropDown
      :filters="filters"
      @update:filters="$emit('update:filters', $event)"
      :togglerClass="togglerClass"
      :history="history"
      :hide="hide"
    >
      <slot></slot>
    </TransactionsFilterDropDown>
  </template>
</template>
