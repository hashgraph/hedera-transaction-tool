<script setup lang="ts">
import AppInput from './AppInput.vue';
import { onMounted, ref } from 'vue';

/* Props */
const props = defineProps<{
  modelValue?: string;
  filled?: boolean;
  size?: 'small' | 'large' | undefined;
  hasCrossIcon?: boolean;
  onCrossIconClick?: () => void;
}>();

/* Emits */
const emit = defineEmits(['update:modelValue']);

/* State */
const beforeItemRef = ref<HTMLDivElement | null>(null);
const afterItemRef = ref<HTMLDivElement | null>(null);
const inputRef = ref<InstanceType<typeof AppInput> | null>(null);

/* Handlers */
const handleUpdateModelValue = (value: string) => {
  emit('update:modelValue', value);
};

/* Hooks */
onMounted(() => {
  const getNumberFromPixels = (string: string) => Number(string.split('px')[0]);

  if (inputRef.value?.inputRef) {
    const { paddingLeft, paddingRight } = getComputedStyle(inputRef.value.inputRef);

    if (beforeItemRef.value) {
      const { width: beforeItemWidth } = getComputedStyle(beforeItemRef.value);
      inputRef.value.inputRef.style.paddingLeft = `${
        getNumberFromPixels(beforeItemWidth) + getNumberFromPixels(paddingLeft)
      }px`;
    }

    if (afterItemRef.value && props.hasCrossIcon) {
      const { width: afterItemWidth } = getComputedStyle(afterItemRef.value);
      inputRef.value.inputRef.style.paddingRight = `${
        getNumberFromPixels(afterItemWidth) + getNumberFromPixels(paddingRight)
      }px`;
    }
  }
});

/* Exposes */
defineExpose({
  inputRef,
});
</script>
<template>
  <div class="public-key-input">
    <div ref="beforeItemRef" class="public-key-input-before text-small border-end px-4">
      <span class="bi bi-key"> </span>
      <span class="ms-2">Public Key</span>
    </div>

    <AppInput
      ref="inputRef"
      :model-value="modelValue"
      :size="size"
      :filled="filled"
      @update:model-value="handleUpdateModelValue"
    />

    <div
      v-if="hasCrossIcon"
      ref="afterItemRef"
      class="public-key-input-after text-small border-start px-4"
    >
      <span class="bi bi-x-lg" @click="onCrossIconClick"> </span>
    </div>
  </div>
</template>
