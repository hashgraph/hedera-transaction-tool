<script setup lang="ts"  generic="T">
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';

/* Props */
const props = defineProps<{
  label: string;
  itemAndLabels: { item: T, label: string }[];
}>();

/* Models */
const selectedItems = defineModel<T[]>('selectedItems', { required: true });

/* Handlers */
const handleSelectItem = (item: T): void => {
  const i = selectedItems.value.indexOf(item);
  if (i === -1) {
    selectedItems.value.push(item);
  } else {
    selectedItems.value.splice(i, 1);
  }
};

const handleRemoveFilter = (e: Event): void => {
  e.stopPropagation();
  selectedItems.value = [];
};
</script>

<template>
  <div class="d-flex gap-3">
    <div class="flex-centered justify-content-between gap-4">
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
                <i class="bi bi-filter text-subheader me-1"></i>{{ props.label }}
              </span>
            </slot>
          </AppButton>
          <ul class="dropdown-menu text-small mt-2">
            <div class="overflow-auto pe-3" :style="{ maxHeight: '35vh' }">
              <div class="d-flex flex-column gap-2">
                <template v-for="ial in props.itemAndLabels" :key="ial">
                  <div class="d-flex align-items-center">
                    <div
                      v-if="selectedItems.length > 0"
                      class="visible-on-hover activate-on-sibling-hover"
                      :selected="selectedItems.includes(ial.item) ? true : undefined"
                    >
                      <AppCheckBox
                        :checked="selectedItems.includes(ial.item)"
                        @update:checked="handleSelectItem(ial.item)"
                        name="select-transaction-item"
                        class="cursor-pointer"
                      />
                    </div>
                    <div
                      class="dropdown-item container-multiple-select activate-on-sibling-hover overflow-hidden w-100 p-3 mt-0"
                      :class="{
                        'is-selected': selectedItems.includes(ial.item),
                      }"
                      @click="handleSelectItem(ial.item)"
                    >
                      <p class="text-small text-semi-bold overflow-hidden">{{ ial.label }}</p>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </ul>
        </div>
        <span
          v-if="selectedItems.length > 0"
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
