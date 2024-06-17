<script setup lang="ts">
import { computed } from 'vue';

import { ITransaction, BackEndTransactionType } from '@main/shared/interfaces';

import MultipleSelectFilterField from './MultipleSelectFilterField.vue';

/* Props */
const props = defineProps<{
  filter: {
    property: keyof ITransaction;
    rule: string;
    value: string | string[];
  } | null;
  inline?: boolean;
  history?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:filter']);

/* Computed */
const selectedTypes = computed(() => {
  if (!props.filter) return [];
  return Array.isArray(props.filter.value) ? props.filter.value : [props.filter.value];
});

/* Misc */
const types = Object.values(BackEndTransactionType).map(type => ({
  value: type,
  label: type
    .toLocaleLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' '),
}));

const label = 'Transaction Type';
</script>
<template>
  <MultipleSelectFilterField
    :filter="filter"
    @update:filter="emit('update:filter', $event)"
    :property="'type'"
    :label="label"
    :items="types"
    :inline="inline"
  >
    <template #dropdown-toggler-content>
      <span class="flex-centered">
        <template v-if="inline">
          <i class="bi bi-filter text-subheader me-1"></i>{{ label }}
        </template>
        <template v-else>
          {{ selectedTypes.length > 0 ? 'Select Type' : 'All' }}
        </template>
      </span>
    </template>
  </MultipleSelectFilterField>
</template>
