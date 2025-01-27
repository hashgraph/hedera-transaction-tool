<script setup lang="ts">
import AppInput from './AppInput.vue';
import { nextTick, onMounted, onUpdated, ref } from 'vue';

/* Props */
const props = withDefaults(
  defineProps<{
    modelValue?: string;
    filled?: boolean;
    size?: 'small' | 'large' | undefined;
    label?: string;
    hasCrossIcon?: boolean;
    onCrossIconClick?: () => void;
    inputDataTestId?: string;
    removeDataTestId?: string;
  }>(),
  {
    label: 'Public key',
  },
);

/* Emits */
const emit = defineEmits(['update:modelValue']);

/* State */
const beforeItemRef = ref<HTMLDivElement | null>(null);
const afterItemRef = ref<HTMLDivElement | null>(null);
const inputRef = ref<InstanceType<typeof AppInput> | null>(null);
const initialPaddingX = ref<[number, number]>([0, 0]);

/* Handlers */
const handleUpdateModelValue = (value: string) => {
  emit('update:modelValue', value);
};

const handlePaddingUpdate = () => {
  if (inputRef.value?.inputRef) {
    if (beforeItemRef.value) {
      const { width: beforeItemWidth } = getComputedStyle(beforeItemRef.value);
      inputRef.value.inputRef.style.paddingLeft = `${
        getNumberFromPixels(beforeItemWidth) + initialPaddingX.value[0]
      }px`;
    }

    if (afterItemRef.value && props.hasCrossIcon) {
      const { width: afterItemWidth } = getComputedStyle(afterItemRef.value);
      inputRef.value.inputRef.style.paddingRight = `${
        getNumberFromPixels(afterItemWidth) + initialPaddingX.value[1]
      }px`;
    }
  }
};

/* Hooks */
onMounted(() => {
  if (inputRef.value?.inputRef) {
    const { paddingLeft, paddingRight } = getComputedStyle(inputRef.value.inputRef);
    initialPaddingX.value = [getNumberFromPixels(paddingLeft), getNumberFromPixels(paddingRight)];
  }

  handlePaddingUpdate();
});

onUpdated(async () => {
  await nextTick();
  handlePaddingUpdate();
});

/* Functions */
function getNumberFromPixels(string: string) {
  return Number(string.split('px')[0]);
}

/* Exposes */
defineExpose({
  inputRef,
});
</script>
<template>
  <div class="public-key-input">
    <div ref="beforeItemRef" class="public-key-input-before text-small border-end px-4">
      <span class="bi bi-key"> </span>
      <span class="ms-2">{{ label }}</span>
    </div>

    <AppInput
      ref="inputRef"
      :model-value="modelValue"
      :size="size"
      :filled="filled"
      @update:model-value="handleUpdateModelValue"
      :data-testid="inputDataTestId"
      v-bind="$attrs"
    />

    <div
      v-if="hasCrossIcon"
      ref="afterItemRef"
      class="public-key-input-after text-small border-start px-4"
    >
      <span
        class="bi bi-x-lg cursor-pointer"
        @click="onCrossIconClick"
        :data-testid="removeDataTestId"
      >
      </span>
    </div>
  </div>
</template>
