<script setup lang="ts">
import { computed } from 'vue';

import { ITransaction, TransactionStatus } from '@main/shared/interfaces';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';

/* Props */
const props = defineProps<{
  filter: {
    property: keyof ITransaction;
    rule: string;
    value: string | string[];
  }[];
  togglerClass?: string;
  history?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:filter']);

/* Computed */
const selectedStatuses = computed(() =>
  props.filter
    .filter(f => f.property === 'status')
    .map(f => f.value)
    .flat(),
);

/* Handlers */
const handleSelectStatus = (status: TransactionStatus) => {
  if (selectedStatuses.value.includes(status)) {
    removeStatus(status);
  } else {
    addStatus(status);
  }
};

/* Functions */
function addStatus(status: TransactionStatus) {
  if (selectedStatuses.value.length === 0) {
    emit('update:filter', [
      ...props.filter,
      {
        property: 'status',
        rule: 'in',
        value: [status],
      },
    ]);
  } else {
    const newFilter = props.filter.map(f => {
      if (f.property === 'status') {
        return {
          ...f,
          value: [...f.value, status],
        };
      }
      return f;
    });
    emit('update:filter', newFilter);
  }
}

function removeStatus(status: TransactionStatus) {
  if (!selectedStatuses.value.includes(status)) return;

  let newFilter;

  if (selectedStatuses.value.length === 1) {
    newFilter = props.filter.filter(f => f.property !== 'status');
    emit('update:filter', newFilter);
  } else {
    newFilter = props.filter.map(f => {
      if (f.property === 'status') {
        return {
          ...f,
          value:
            typeof f.value === 'string'
              ? selectedStatuses.value.filter(f => f !== status)
              : f.value.filter(v => v !== status),
        };
      }
      return f;
    });
  }

  emit('update:filter', newFilter);
}

/* Misc */
const allowedStatuses = [
  TransactionStatus.EXECUTED,
  TransactionStatus.EXPIRED,
  TransactionStatus.FAILED,
];
const statuses = Object.values(TransactionStatus)
  .filter(s => (props.history ? allowedStatuses.includes(s) : true))
  .map(status => ({
    value: status,
    label: status
      .toLocaleLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
  }));
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
    <ul class="dropdown-menu text-small p-5" :style="{ maxWidth: '500px' }">
      <div class="flex-centered justify-content-between gap-4">
        <p>Status</p>
        <div class="dropdown">
          <AppButton
            class="text-dark-emphasis border border-1 w-100 px-3 py-1"
            type="button"
            data-bs-toggle="dropdown"
            data-bs-auto-close="outside"
          >
            <span class="overflow-hidden">
              {{ filter.find(f => f.property === 'status') ? 'Select Statuses' : 'All' }}
            </span>
          </AppButton>
          <ul class="dropdown-menu text-small mt-2">
            <template v-for="status in statuses" :key="status">
              <div class="d-flex align-items-center mt-2">
                <div
                  class="visible-on-hover activate-on-sibling-hover"
                  :selected="selectedStatuses.includes(status.value) ? true : undefined"
                >
                  <AppCheckBox
                    :checked="selectedStatuses.includes(status.value)"
                    @update:checked="handleSelectStatus(status.value)"
                    name="select-transaction-status"
                    class="cursor-pointer"
                  />
                </div>
                <div
                  class="dropdown-item container-multiple-select activate-on-sibling-hover overflow-hidden w-100 p-3"
                  :class="{
                    'is-selected': selectedStatuses.includes(status.value),
                  }"
                  @click="handleSelectStatus(status.value)"
                >
                  <p class="text-small text-semi-bold overflow-hidden">{{ status.label }}</p>
                </div>
              </div>
            </template>
          </ul>
        </div>
      </div>

      <hr class="separator mt-3" />
    </ul>
  </div>
</template>
