<script setup lang="ts">
/* Props */
defineProps<{
  label: string;
  value: string;
  'data-testid'?: string;
}>();
</script>
<template>
  <div class="row">
    <div class="col-5">
      <p class="text-small text-semi-bold">{{ label }}</p>
    </div>
    <div class="col-7">
      <p class="text-small text-secondary overflow-hidden" :data-testid="['data-testid']">
        {{ value }}
        <slot></slot>
      </p>
    </div>
  </div>
</template>
