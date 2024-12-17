<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue';

import AppInput from './AppInput.vue';

/* Options */
defineOptions({
  inheritAttrs: false
})

/* Props */
const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    filled?: boolean;
    size?: 'small' | 'large' | undefined;
    autoTrim?: boolean;
    showIcon?: boolean;
  }>(),
  {
    showIcon: true,
  },
);

/* Composables */
const attrs = useAttrs();

/* State */
const isPasswordVisible = ref(false);

/* Computed */
const mergedProps = computed(() => ({
  ...props,
  ...attrs,
}));

/* Functions */
const togglePasswordVisibility = () => {
  isPasswordVisible.value = !isPasswordVisible.value;
};
</script>

<template>
  <div
    class="password-input-wrapper d-flex align-items-center position-relative"
  >
    <AppInput
      class="pe-7"
      v-bind="mergedProps"
      :type="isPasswordVisible ? 'text' : 'password'"
      @update:modelValue="$emit('update:modelValue', $event)"
    />
    <button
      v-if="props.showIcon"
      type="button"
      class="position-absolute border-0 bg-transparent cursor-pointer"
      style="right: 10px;"
      tabindex="-1"
      @click="togglePasswordVisibility"
    >
      <span :class="isPasswordVisible ? 'bi bi-eye-slash' : 'bi bi-eye'" />
    </button>
  </div>
</template>
