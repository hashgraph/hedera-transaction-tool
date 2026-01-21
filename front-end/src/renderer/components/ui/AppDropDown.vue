<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = defineProps<{
  toggleText?: string;
  items: { label: string; value: string }[];
  color?: 'primary' | 'secondary' | 'borderless' | 'danger';
  active?: boolean;
  dataTestid?: string;
  togglerIcon?: boolean;
  colorOnActive?: boolean;
  buttonClass?: string;
  compact?: boolean;
  disabled?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'select', value: string): void;
}>();

/* State */
const dropdownRef = ref<HTMLDivElement | null>(null);

/* Handlers */
const handleSelect = (value: string) => {
  emit('select', value);
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
      :class="[active ? null : 'text-body', compact ? 'min-w-unset px-4' : '', buttonClass]"
      :disabled="disabled"
    >
      <template v-if="compact">
        <i class="bi bi-three-dots-vertical"></i>
      </template>
      <template v-else>
        <div class="col-11 text-start overflow-hidden">
          <span>{{ toggleText }}</span>
        </div>
        <div class="col-1 ms-3">
          <i v-if="togglerIcon" class="bi bi-chevron-down flex-1"></i>
        </div>
      </template>
    </AppButton>
    <ul class="dropdown-menu mt-3">
      <template v-for="item of items" :key="item.value">
        <li
          class="dropdown-item cursor-pointer text-body"
          @click="handleSelect(item.value)"
          :data-testid="`${dataTestid}-item-${item.value}`"
        >
          <span class="text-small">{{ item.label }}</span>
        </li>
      </template>
    </ul>
  </div>
</template>
