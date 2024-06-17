<script setup lang="ts">
import { ITransaction } from '@main/shared/interfaces';

import AppButton from '@renderer/components/ui/AppButton.vue';
import StatusField from '@renderer/components/Filter/StatusField.vue';

/* Props */
const props = defineProps<{
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
      <div v-if="!hide?.includes('status')">
        <StatusField
          :filter="filters.find(f => f.property === 'status') || null"
          @update:filter="handleStatusUpdate"
          :history="history"
        />
      </div>
    </ul>
  </div>
</template>
