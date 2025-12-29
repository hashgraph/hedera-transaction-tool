<script setup lang="ts">
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Models */
const show = defineModel<boolean>('show', { required: true });
</script>

<template>
  <AppModal v-model:show="show"> </AppModal>
</template>

<style scoped></style>
