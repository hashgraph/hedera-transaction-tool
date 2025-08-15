<script setup lang="ts">
import type { ITransaction } from '@shared/interfaces';

import StatusField from '@renderer/components/Filter/StatusField.vue';
import TransactionTypeField from '@renderer/components/Filter/TransactionTypeField.vue';

/* Props */
const props = defineProps<{
  filters: {
    property: keyof ITransaction;
    rule: string;
    value: string | string[];
  }[];
  inline?: boolean;
  history?: boolean;
  hide?: (keyof ITransaction)[];
}>();

/* Emits */
const emit = defineEmits(['update:filters']);

/* Handlers */
const handleUpdate = (
  property: keyof ITransaction,
  filter: { property: keyof ITransaction; rule: string; value: string[] } | null,
) => {
  emit(
    'update:filters',
    filter
      ? [...props.filters.filter(f => f.property !== property), filter]
      : props.filters.filter(f => f.property !== property),
  );
};
</script>
<template>
  <div v-if="!hide?.includes('status')">
    <StatusField
      :filter="filters.find(f => f.property === 'status') || null"
      @update:filter="filter => handleUpdate('status', filter)"
      :inline="inline"
      :history="history"
    />
  </div>
  <hr v-if="!hide?.includes('type') && !inline" class="separator my-3" />
  <div v-if="!hide?.includes('type')">
    <TransactionTypeField
      :filter="filters.find(f => f.property === 'type') || null"
      @update:filter="filter => handleUpdate('type', filter)"
      :inline="inline"
    />
  </div>
</template>
