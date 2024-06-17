<script setup lang="ts">
import { ITransaction } from '@main/shared/interfaces';

import AppButton from '@renderer/components/ui/AppButton.vue';
import StatusField from '@renderer/components/Filter/StatusField.vue';

/* Props */
const props = defineProps<{
  filter: {
    property: keyof ITransaction;
    rule: string;
    value: string | string[];
  }[];
  togglerClass?: string;
  history?: boolean;
  hideStatus?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:filter']);

/* Handlers */
const handleStatusUpdate = (
  filter: { property: 'status'; rule: string; value: string[] } | null,
) => {
  emit(
    'update:filter',
    filter
      ? [...props.filter.filter(f => f.property !== 'status'), filter]
      : props.filter.filter(f => f.property !== 'status'),
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
      <div v-if="!hideStatus">
        <StatusField
          :filter="filter.find(f => f.property === 'status') || null"
          @update:filter="handleStatusUpdate"
          :history="true"
        />
        <hr class="separator mt-3" />
      </div>
    </ul>
  </div>
</template>
