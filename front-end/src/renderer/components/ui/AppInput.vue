<script setup lang="ts">
import { computed, ref } from 'vue';

/* Props */
const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    filled?: boolean;
    size?: 'small' | 'large' | undefined;
    autoTrim?: boolean;
  }>(),
  {
    autoTrim: true,
  },
);

/* Emits */
const emit = defineEmits(['update:modelValue']);

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

/* Handlers */
const handleInput = (e: Event) => {
  const value = (e.target as HTMLInputElement).value;
  emit('update:modelValue', props.autoTrim ? value.trim() : value);
};

const handleBlur = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (props.autoTrim) {
    target.value = target.value.trim();
  }

  emit('update:modelValue', target.value);
};

/* Exposes */
defineExpose({
  inputRef,
});
</script>
<template>
  <input
    ref="inputRef"
    :value="modelValue"
    @input="handleInput"
    @blur="handleBlur"
    :class="[sizeClass, fillClass]"
  />
</template>
