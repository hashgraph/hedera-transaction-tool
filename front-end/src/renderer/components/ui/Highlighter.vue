<script setup lang="ts">
/* Props */
const props = defineProps<{
  visible: boolean;
}>();
</script>

<template>
  <div class="d-inline-flex align-items-center py-2 gap-4" v-if="props.visible">
    <slot />
    <i class="bi bi-arrow-left-circle-fill text-success fs-2" />
  </div>
  <slot v-else />
</template>

<style scoped></style>
