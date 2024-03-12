<script setup lang="ts">
import { ref } from 'vue';

import { Hbar, HbarUnit } from '@hashgraph/sdk';

import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  modelValue: Hbar;
  placeholder?: string;
  filled?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:modelValue']);

/* State */
const appInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const appInputValue = ref(props.modelValue.toBigNumber().toString());

/* Handlers */
const handleUpdateValue = async value => {
  const separatorIndex = value.search(/[.,]/);

  if (separatorIndex !== -1 && value.length - separatorIndex - 1 > 8) {
    value = value.slice(0, separatorIndex + 9);

    if (appInputRef.value?.inputRef?.value) {
      appInputRef.value.inputRef.value = value;
    }
  }

  if (value.length > 0 && value[value.length - 1] === '.') {
    value = value + '0';
  }

  const hbar = Hbar.fromString(value || '0', HbarUnit.Hbar);
  emit('update:modelValue', hbar);
};

const handleKeyDown = e => {
  const regex = /^[0-9.]+$/;

  if (
    (!regex.test(e.key) && !e.ctrlKey && !e.metaKey && e.key.length === 1) ||
    (appInputRef.value?.inputRef?.value.includes('.') && e.key === '.')
  ) {
    e.preventDefault();
  }
};
</script>
<template>
  <AppInput
    ref="appInputRef"
    :model-value="appInputValue"
    @update:model-value="handleUpdateValue"
    @keydown="handleKeyDown"
    type="text"
    :filled="Boolean(filled)"
    :placeholder="placeholder"
  />
</template>
