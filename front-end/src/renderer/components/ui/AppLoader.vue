<script setup lang="ts">
/* Props */
defineProps<{
  loadingText?: string;
}>();
</script>
<template>
  <div class="d-flex justify-content-center align-items-center">
    <div class="container-loader" data-testid="div-loader"></div>
    <p v-if="loadingText" class="mt-3">{{ loadingText }}</p>
  </div>
</template>
