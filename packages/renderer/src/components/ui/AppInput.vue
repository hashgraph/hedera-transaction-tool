<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue?: string | number;
  filled?: boolean;
  size?: 'small' | 'large' | undefined;
}>();
defineEmits(['update:modelValue']);

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
</script>
<template>
  <input
    :value="modelValue"
    @input="$emit('update:modelValue', ($event.target! as HTMLInputElement).value)"
    :class="[sizeClass, fillClass]"
  />
</template>
