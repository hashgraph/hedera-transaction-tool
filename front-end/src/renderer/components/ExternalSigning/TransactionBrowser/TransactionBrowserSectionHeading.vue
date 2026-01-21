<script setup lang="ts">
/* Props */
const props = defineProps<{
  title: string;
}>();
</script>

<template>
  <hr class="separator my-5" />
  <div class="d-flex justify-content-between align-items-center">
    <h2 class="text-title text-bold">{{ props.title }}</h2>
  </div>
</template>
