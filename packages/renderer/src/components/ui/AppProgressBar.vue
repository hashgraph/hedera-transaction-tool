<script setup lang="ts">
withDefaults(
  defineProps<{
    percent: number;
    label?: string;
    height?: number;
  }>(),
  {
    height: 20,
  },
);
</script>
<template>
  <div
    class="progress"
    role="progressbar"
    aria-label="Example with label"
    :aria-valuenow="percent"
    aria-valuemin="0"
    aria-valuemax="100"
    :style="{
      height: `${height}px`,
    }"
  >
    <div
      class="progress-bar"
      :style="{width: `${percent}%`}"
      >{{ label }}</div
    >
  </div>
</template>
