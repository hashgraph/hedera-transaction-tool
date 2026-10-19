<script setup lang="ts">
import { ref, watch } from 'vue';

import { Hbar, HbarUnit } from '@hiero-ledger/sdk';

import { formatHbar } from '@renderer/utils/sdk';

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
const appInputValue = ref(formatHbar(props.modelValue));

/* Handlers */
const handleUpdateValue = async (value: string) => {
  value = sanitizeAmount(value);
  setInputValue(value);

  if (value === '' || value === '.' || value === '0') {
    emit('update:modelValue', new Hbar(0));
    return;
  }

  if (value.startsWith('.')) {
    value = '0' + value;
    setInputValue(value);
  }

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

  try {
    const hbar = Hbar.fromString(value || '0', HbarUnit.Hbar);
    emit('update:modelValue', hbar);
  } catch {
    throw new Error('Invalid Hbar value');
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  const regex = /^[0-9.]+$/;

  if (
    (!regex.test(e.key) && !e.ctrlKey && !e.metaKey && e.key.length === 1) ||
    (appInputRef.value?.inputRef?.value.includes('.') && e.key === '.')
  ) {
    e.preventDefault();
  }
};

const handleBlur = () => {
  // A blank (or lone '.') amount is 0, so always show it
  setInputValue(formatHbar(props.modelValue));
};

/* Functions */
// Typing is already filtered in handleKeyDown; this covers paste/autofill
function sanitizeAmount(value: string) {
  const digitsAndDots = value.trim().replace(/[^0-9.]/g, '');
  const firstDot = digitsAndDots.indexOf('.');
  return firstDot === -1
    ? digitsAndDots
    : digitsAndDots.slice(0, firstDot + 1) + digitsAndDots.slice(firstDot + 1).replace(/\./g, '');
}

function setValue(value: Hbar) {
  setInputValue(formatHbar(value));
  appInputValue.value = formatHbar(value);
}

function setInputValue(value: string) {
  if (appInputRef.value?.inputRef) {
    appInputRef.value.inputRef.value = value;
  }
}

/* Watchers */
watch(
  () => props.modelValue,
  value => {
    if (formatHbar(value) !== appInputValue.value) {
      setValue(value);
    }
  },
);
</script>
<template>
  <AppInput
    ref="appInputRef"
    :model-value="appInputValue"
    @update:model-value="handleUpdateValue"
    @keydown="handleKeyDown"
    @blur="handleBlur"
    type="text"
    :filled="Boolean(filled)"
    :placeholder="placeholder"
  />
</template>
