<script setup lang="ts">
import { InputStatus } from '@renderer/components/InputStatus.ts';
import { computed } from 'vue';

/* Props */
const props = defineProps<{ status: InputStatus; invalidMessage: string }>();

/* Computed */
const opacityClass = computed(() =>
  props.status == InputStatus.invalid ? 'opacity-100' : 'opacity-0',
);
const ariaHidden = computed(() => props.status == InputStatus.invalid);
</script>

<template>
  <span class="text-warning text-micro" :class="opacityClass" :aria-hidden="ariaHidden">
    <i class="bi bi-exclamation-triangle-fill me-1" />
    {{ props.invalidMessage }}
  </span>
</template>

<style scoped></style>
