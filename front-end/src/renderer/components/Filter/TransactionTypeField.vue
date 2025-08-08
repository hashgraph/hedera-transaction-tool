<script setup lang="ts">
import type { ITransaction } from '@shared/interfaces';

import { BackEndTransactionType } from '@shared/interfaces';

import MultipleSelectFilterField from './MultipleSelectFilterField.vue';

/* Props */
defineProps<{
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
  />
</template>
