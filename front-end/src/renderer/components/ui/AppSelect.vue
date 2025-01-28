<script setup lang="ts" generic="T">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = defineProps<{
  toggleText: string;
  items: { label: string; value: T }[];
  color?: 'primary' | 'secondary' | 'borderless' | 'danger';
  active?: boolean;
  dataTestid?: string;
  togglerIcon?: boolean;
  colorOnActive?: boolean;
  buttonClass?: string | string[];
}>();

/* Model */
const model = defineModel<T>('value');

/* State */
const dropdownRef = ref<HTMLDivElement | null>(null);

/* Computed */
const selected = computed(() => props.items.find(i => i.value === model.value));

/* Handlers */
const handleSelect = (value: T) => {
  model.value = value;
  forceHideContent();
};

const handleWindowClick = (e: Event) => {
  if (!dropdownRef.value?.contains(e.target as Node)) {
    forceHideContent();
  }
};

/* Functions */
const forceHideContent = () => {
  dropdownRef.value?.querySelector('ul')?.classList.remove('show');
};

/* Hooks */
onMounted(() => {
  window.addEventListener('click', handleWindowClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleWindowClick);
});

/* Watchers */
watch(
  () => props.active,
  () => {
    // Workaround because of bootstrap + vue bug
    if (!props.active) {
      forceHideContent();
    }
  },
);
</script>
<template>
  <div ref="dropdownRef" class="dropdown">
    <AppButton
      :color="(colorOnActive && active) || !colorOnActive ? color : undefined"
      class="d-flex flex-centered justify-content-between mw-100"
      data-bs-toggle="dropdown"
      data-bs-auto-close="true"
      data-bs-popper-config='{"strategy":"fixed"}'
      :data-testid="dataTestid"
      :class="[buttonClass]"
    >
      <div class="col-11 text-start overflow-hidden">
        <span>{{ selected?.label || toggleText }}</span>
      </div>
      <div class="col-1 ms-3">
        <i v-if="togglerIcon" class="bi bi-chevron-down flex-1"></i>
      </div>
    </AppButton>
    <ul class="dropdown-menu mt-3">
      <template v-if="items.length === 0">
        <li class="px-4 py-3 text-body user-select-none">
          <span class="text-small">No options available</span>
        </li>
      </template>
      <template v-for="item of items" :key="item.value">
        <li
          class="dropdown-item text-body"
          :class="{
            active: item.value === value,
          }"
          @click="handleSelect(item.value)"
          :data-testid="`select-item-${item.value}`"
          :selected="item.value === value ? true : undefined"
        >
          <span class="text-small">{{ item.label }}</span>
        </li>
      </template>
    </ul>
  </div>
</template>
