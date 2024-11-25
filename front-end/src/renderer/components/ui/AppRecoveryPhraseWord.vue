<script setup lang="ts">
import { computed, ref } from 'vue';

/* Props */
const props = defineProps<{
  word: string;
  handleWordChange?: (newWord: string) => void;
  readonly?: boolean;
  withToggler?: boolean;
  index?: number;
  visibleInitially?: boolean;
  verification?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:word']);

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
      class="form-control is-fill"
      :class="verification ? 'border-pink' : ''"
      :type="inputType"
      :readonly="readonly"
      :value="word"
      @input="handldeWordInput"
      :data-testid="`input-recovery-word-${index}`"
    />
    <Transition name="fade" mode="out-in" v-if="withToggler">
      <i v-if="!isVisible" class="bi bi-eye" @click="handleVisibiltyChange"></i>
      <i v-else class="bi bi-eye-slash" @click="handleVisibiltyChange"></i>
    </Transition>
  </div>
</template>
