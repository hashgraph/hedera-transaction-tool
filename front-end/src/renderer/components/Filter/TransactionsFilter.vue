<script setup lang="ts">
import { ITransaction } from '@main/shared/interfaces';

import TransactionsFilterDropDown from '@renderer/components/Filter/TransactionsFilterDropDown.vue';
import StatusField from '@renderer/components/Filter/StatusField.vue';

/* Props */
const props = defineProps<{
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
const emit = defineEmits(['update:filters']);

/* Handlers */
const handleStatusUpdate = (
  filter: { property: 'status'; rule: string; value: string[] } | null,
) => {
  emit(
    'update:filters',
    filter
      ? [...props.filters.filter(f => f.property !== 'status'), filter]
      : props.filters.filter(f => f.property !== 'status'),
  );
};
</script>
<template>
  <template v-if="inline">
    <div class="row flex-wrap text-small">
      <div v-if="!hide?.includes('status')" class="col-3">
        <StatusField
          :filter="filters.find(f => f.property === 'status') || null"
          @update:filter="handleStatusUpdate"
          :inline="true"
          :history="history"
        />
      </div>
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
