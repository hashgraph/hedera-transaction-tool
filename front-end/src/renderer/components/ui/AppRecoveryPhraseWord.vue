<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';

/* Props */
const props = defineProps<{
  word: string;
  handleWordChange?: (newWord: string) => void;
  readonly?: boolean;
  withToggler?: boolean;
  index?: number;
  visibleInitially?: boolean;
  verification?: boolean;
  isFocused?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:word']);

/* Ref */
const inputRef = ref<HTMLInputElement | null>(null);

/* State */
const isVisible = ref(props.visibleInitially);

/* Getters */
const inputType = computed(() => (isVisible.value ? 'text' : 'password'));

/* Handlers */
const handleVisibiltyChange = () => {
  isVisible.value = !isVisible.value;
};

const handldeWordInput = (e: Event) => {
  const value = (e.target as HTMLInputElement).value;
  props.handleWordChange && props.handleWordChange(value);

  emit('update:word', value);
};

const handleKeyDown = (e: KeyboardEvent) => {
  const inputs = document.querySelectorAll('input[data-testid^="input-recovery-word-"]');
  const currentIndex = Array.from(inputs).findIndex(input => input === e.target);

  if (e.key === 'ArrowRight' && currentIndex < inputs.length - 1) {
    e.preventDefault();
    (inputs[currentIndex + 1] as HTMLInputElement).focus();
    const nextInput = inputs[currentIndex + 1] as HTMLInputElement;
    nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
  } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
    e.preventDefault();
    (inputs[currentIndex - 1] as HTMLInputElement).focus();
    const previousInput = inputs[currentIndex - 1] as HTMLInputElement;
    previousInput.setSelectionRange(previousInput.value.length, previousInput.value.length);
  } else if (e.key === 'ArrowDown' && currentIndex < inputs.length - 4) {
    e.preventDefault();
    (inputs[currentIndex + 4] as HTMLInputElement).focus();
  } else if (e.key === 'ArrowUp' && currentIndex >= 4) {
    e.preventDefault();
    (inputs[currentIndex - 4] as HTMLInputElement).focus();
  }
};

onMounted(() => {
  if (props.isFocused) {
    inputRef.value?.focus();
    inputRef.value?.setSelectionRange(inputRef.value.value.length, inputRef.value.value.length);
  }
});
</script>
<template>
  <div
    class="recovery-phrase-word position-relative"
    :style="{ height: 'fit-content' }"
    :hasIndex="index"
    :withToggler="withToggler"
    :readonly="readonly"
  >
    <span v-if="index" class="word-index text-small">{{ index }}.</span>
    <input
      ref="inputRef"
      class="form-control is-fill"
      :class="verification ? 'border-pink' : ''"
      :type="inputType"
      :readonly="readonly"
      :value="word"
      @input="handldeWordInput"
      @keydown="handleKeyDown"
      :data-testid="`input-recovery-word-${index}`"
    />
    <Transition name="fade" mode="out-in" v-if="withToggler">
      <i v-if="!isVisible" class="bi bi-eye" @click="handleVisibiltyChange"></i>
      <i v-else class="bi bi-eye-slash" @click="handleVisibiltyChange"></i>
    </Transition>
  </div>
</template>
