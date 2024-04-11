<script setup lang="ts">
import { ref } from 'vue';

import AppInput from './ui/AppInput.vue';

type Size = 'sm' | 'md' | 'lg';

/* Props */
const props = withDefaults(
  defineProps<{
    length?: number;
    size?: Size;
  }>(),
  {
    length: 8,
    size: 'sm',
  },
);

/* Emits */
const emit = defineEmits<{
  (
    event: 'otpChanged',
    otp: {
      value: string;
      isValid: boolean;
    },
  ): void;
}>();

/* State */
const otpContainerRef = ref<HTMLDivElement | null>(null);

/* Handlers */
const handleInputChange = (e: KeyboardEvent) => {
  if (e.key === 'v' && (e.ctrlKey || e.metaKey)) return;

  const target = e.target as HTMLInputElement;

  if (e.key === 'Backspace') {
    target.value = '';
    if (target.previousSibling && target.previousSibling instanceof HTMLInputElement) {
      target.previousSibling.focus();
    }
  } else {
    if (!target.nextSibling && target.value !== '') {
      return true;
    } else if (e.keyCode > 47 && e.keyCode < 58 && !e.shiftKey) {
      target.value = e.key;
      if (target.nextSibling && target.nextSibling instanceof HTMLInputElement) {
        target.nextSibling.focus();
      }
      e.preventDefault();
    } else {
      e.preventDefault();
    }
  }

  emit('otpChanged', getOTP());

  return true;
};

/* Handle Paste */
const handlePaste = async (e: ClipboardEvent) => {
  e.preventDefault();

  const text = await navigator.clipboard.readText();

  if (text.trim().length === props.length && /^\d+$/.test(text)) {
    text.split('').forEach((char, index) => {
      const input = otpContainerRef.value?.querySelector(
        `input[index="${index}"]`,
      ) as HTMLInputElement;
      if (input) input.value = char;
    });

    emit('otpChanged', getOTP());
  }
};

/* Misc */
function getOTP() {
  const inputs = otpContainerRef.value?.querySelectorAll('input');
  if (!inputs) return { value: '', isValid: false };

  const otp: string[] = [];

  inputs.forEach(input => {
    const index = input.getAttribute('index');

    if (index && !isNaN(Number(index))) {
      otp[index] = input.value;
    }
  });

  return {
    value: otp.join(''),
    isValid: otp.filter(Boolean).length === props.length,
  };
}

function focus() {
  const input = otpContainerRef.value?.querySelector('input') as HTMLInputElement;
  if (input) input.focus();
}

const sizes: {
  [key in Size]: number;
} = {
  sm: 40,
  md: 50,
  lg: 60,
};

/* Exposes */
defineExpose({
  getOTP,
  focus,
});
</script>
<template>
  <div
    ref="otpContainerRef"
    class="d-flex justify-content-between gap-4"
    @keydown="handleInputChange"
    @paste="handlePaste"
  >
    <template v-for="index in length" :key="index">
      <AppInput
        :index="index - 1"
        class="text-center"
        :style="`width: ${sizes[size]}px; height: ${sizes[size]}px`"
      />
    </template>
  </div>
</template>
