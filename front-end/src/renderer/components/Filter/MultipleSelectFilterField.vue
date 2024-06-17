<script setup lang="ts">
import { computed } from 'vue';

import { ITransaction } from '@main/shared/interfaces';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';

/* Props */
const props = defineProps<{
  filter: {
    property: keyof ITransaction;
    rule: string;
    value: string | string[];
  } | null;
  property: keyof ITransaction;
  label: string;
  items: { value: string; label: string }[];
  inline?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:filter']);

/* Computed */
const selectedItems = computed(() => {
  if (!props.filter) return [];
  return Array.isArray(props.filter.value) ? props.filter.value : [props.filter.value];
});

/* Handlers */
const handleSelectItem = (item: string) => {
  if (selectedItems.value.includes(item)) {
    removeItem(item);
  } else {
    addItem(item);
  }
};

/* Functions */
function addItem(item: string) {
  if (selectedItems.value.length === 0 || !props.filter) {
    emit('update:filter', {
      property: props.property,
      rule: 'in',
      value: [item],
    });
  } else {
    emit('update:filter', {
      ...props.filter,
      value: [...props.filter.value, item],
    });
  }
}

function removeItem(item: string) {
  if (!selectedItems.value.includes(item) || !props.filter) return;

  let newFilter;

  if (selectedItems.value.length === 1) {
    emit('update:filter', null);
  } else {
    newFilter = {
      ...props.filter,
      value: selectedItems.value.filter(f => f !== item),
    };
  }

  emit('update:filter', newFilter);
}
</script>
<template>
  <div class="flex-centered justify-content-between gap-4">
    <p v-if="!inline">{{ label }}</p>
    <div class="dropdown">
      <AppButton
        class="text-dark-emphasis w-100 border border-1 px-3 py-1 min-w-unset"
        type="button"
        data-bs-toggle="dropdown"
        data-bs-auto-close="outside"
      >
        <slot name="dropdown-toggler-content">
          <span class="flex-centered">
            <template v-if="inline">
              <i class="bi bi-filter text-subheader me-1"></i>{{ label }}
              <span
                v-if="selectedItems.length > 0"
                class="bubble text-footnote ms-2"
                :style="{ width: '16px', height: '16px' }"
                >{{ selectedItems.length }}</span
              >
            </template>
            <template v-else>
              {{ selectedItems.length > 0 ? `${selectedItems.length} Selected` : 'All' }}
            </template>
          </span>
        </slot>
      </AppButton>
      <ul class="dropdown-menu text-small mt-2">
        <div class="overflow-auto" :style="{ maxHeight: '35vh' }">
          <template v-for="item in items" :key="item">
            <div class="d-flex align-items-center mt-2">
              <div
                class="visible-on-hover activate-on-sibling-hover"
                :selected="selectedItems.includes(item.value) ? true : undefined"
              >
                <AppCheckBox
                  :checked="selectedItems.includes(item.value)"
                  @update:checked="handleSelectItem(item.value)"
                  name="select-transaction-item"
                  class="cursor-pointer"
                />
              </div>
              <div
                class="dropdown-item container-multiple-select activate-on-sibling-hover overflow-hidden w-100 p-3"
                :class="{
                  'is-selected': selectedItems.includes(item.value),
                }"
                @click="handleSelectItem(item.value)"
              >
                <p class="text-small text-semi-bold overflow-hidden">{{ item.label }}</p>
              </div>
            </div>
          </template>
        </div>
      </ul>
    </div>
  </div>
</template>
