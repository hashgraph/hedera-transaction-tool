<script setup lang="ts">
/* Props */
defineProps<{
  loadingText?: string;
}>();
</script>
<template>
  <div class="flex-centered">
    <div class="container-loader" data-testid="div-loader"></div>
    <p v-if="loadingText" class="mt-3">{{ loadingText }}</p>
  </div>
</template>
