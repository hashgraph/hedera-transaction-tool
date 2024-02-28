<script setup lang="ts">
import { computed, ref } from 'vue';

/* Props */
const props = defineProps<{
  modelValue?: string | number;
  filled?: boolean;
  size?: 'small' | 'large' | undefined;
}>();
defineEmits(['update:modelValue']);

/* State */
const inputRef = ref<HTMLInputElement | null>();

/* Computed */
const sizeClass = computed(() => {
  let className = 'form-control';
  switch (props.size) {
    case 'small':
      className += ' form-control-sm';
      break;
    case 'large':
      className += ' form-control-lg';
      break;
    default:
      break;
  }

  return className;
});
const fillClass = computed(() => (props.filled ? 'is-fill' : ''));

/* Exposes */
defineExpose({
  inputRef,
});
</script>
<template>
  <input
    ref="inputRef"
    :value="modelValue"
    @input="$emit('update:modelValue', ($event.target! as HTMLInputElement).value)"
    :class="[sizeClass, fillClass]"
  />
</template>
