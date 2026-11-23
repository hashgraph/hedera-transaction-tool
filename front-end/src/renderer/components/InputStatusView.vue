<script setup lang="ts">
import { InputStatus } from '@renderer/components/InputStatus.ts';
import { computed } from 'vue';

/* Props */
const props = defineProps<{ status: InputStatus; invalidMessage: string }>();

/* Computed */
const opacityClass = computed(() =>
  props.status == InputStatus.invalid ? 'opacity-100' : 'opacity-0',
);
</script>

<template>
  <div class="d-inline-block" style="position: relative; width: 100%">
    <span
      class="text-warning text-micro"
      style="position: absolute; transform: translateY(-80%)"
      :class="opacityClass"
    >
      <i class="bi bi-exclamation-triangle-fill me-1" />
      {{ props.invalidMessage }}
    </span>
  </div>
</template>

<style scoped></style>
