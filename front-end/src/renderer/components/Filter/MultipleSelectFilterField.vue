<script setup lang="ts">
import type { ITransaction } from '@shared/interfaces';

import { computed } from 'vue';

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

const handleRemoveFilter = (e: Event) => {
  e.stopPropagation();
  emit('update:filter', null);
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
  <div class="d-flex gap-3">
    <div class="flex-centered justify-content-between gap-4">
      <p v-if="!inline">{{ label }}</p>
      <div class="rounded border border-1 flex-centered justify-content-between px-3 py-1">
        <div class="dropdown">
          <AppButton
            class="text-dark-emphasis border-0 w-100 p-0 min-w-unset"
            type="button"
            data-bs-toggle="dropdown"
            data-bs-auto-close="outside"
            data-bs-offset="-8,5"
          >
            <slot name="dropdown-toggler-content">
              <span class="flex-centered">
                <template v-if="inline">
                  <i class="bi bi-filter text-subheader me-1"></i>{{ label }}
                </template>
                <template v-else>
                  {{ selectedItems.length > 0 ? `${selectedItems.length} Selected` : 'All' }}
                </template>
              </span>
            </slot>
          </AppButton>
          <ul class="dropdown-menu text-small mt-2">
            <div class="overflow-auto pe-3" :style="{ maxHeight: '35vh' }">
              <div class="d-flex flex-column gap-2">
                <template v-for="item in items" :key="item">
                  <div class="d-flex align-items-center">
                    <div
                      v-if="selectedItems.length > 0"
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
                      class="dropdown-item container-multiple-select activate-on-sibling-hover overflow-hidden w-100 p-3 mt-0"
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
            </div>
          </ul>
        </div>
        <span
          v-if="selectedItems.length > 0 && inline"
          class="bubble text-footnote ms-2"
          :style="{ width: '16px', height: '16px' }"
          >{{ selectedItems.length }}</span
        >
        <span
          v-if="selectedItems.length > 0"
          class="bi bi-x-lg cursor-pointer ms-2"
          @click="handleRemoveFilter"
        ></span>
      </div>
    </div>
  </div>
</template>
