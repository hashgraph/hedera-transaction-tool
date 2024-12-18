<script setup lang="ts">
/* Props */
defineProps<{
  text?: string;
}>();
</script>
<template>
  <div class="flex-centered">
    <template v-if="text">
      <hr class="separator" />
      <span class="mx-3">{{ text }}</span>
      <hr class="separator" />
    </template>
    <template v-else>
      <hr class="separator" />
    </template>
  </div>
</template>
