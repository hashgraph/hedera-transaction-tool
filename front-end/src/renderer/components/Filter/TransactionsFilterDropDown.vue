<script setup lang="ts">
import type { ITransaction } from '@shared/interfaces';

import AppButton from '@renderer/components/ui/AppButton.vue';
import FilterFields from '@renderer/components/Filter/FilterFields.vue';

/* Props */
defineProps<{
  filters: {
    property: keyof ITransaction;
    rule: string;
    value: string | string[];
  }[];
  togglerClass?: string;
  history?: boolean;
  hide?: (keyof ITransaction)[];
}>();

/* Emits */
defineEmits(['update:filters']);
</script>
<template>
  <div class="dropdown">
    <AppButton
      :class="togglerClass"
      type="button"
      data-bs-toggle="dropdown"
      data-bs-auto-close="outside"
    >
      <slot></slot>
    </AppButton>
    <ul class="dropdown-menu text-small p-5">
      <FilterFields
        :filters="filters"
        @update:filters="$emit('update:filters', $event)"
        :inline="false"
        :history="history"
        :hide="hide"
      />
    </ul>
  </div>
</template>
