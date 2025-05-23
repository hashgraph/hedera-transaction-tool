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
    <div class="col-4 d-flex align-items-center">
      <p class="text-small text-semi-bold">{{ label }}</p>
    </div>
    <div class="col-8">
      <p class="text-small text-secondary overflow-hidden" :data-testid="['data-testid']">
        {{ value }}
        <slot></slot>
      </p>
    </div>
  </div>
</template>
