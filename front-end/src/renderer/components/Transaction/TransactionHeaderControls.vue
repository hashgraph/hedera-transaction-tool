<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
defineProps<{
  headingText?: string;
}>();
</script>
<template>
  <div>
    <div class="d-flex align-items-center">
      <AppButton type="button" color="secondary" class="btn-icon-only me-4" @click="$router.back()">
        <i class="bi bi-arrow-left"></i>
      </AppButton>

      <h2 class="text-title text-bold" data-testid="h2-transaction-type">{{ headingText }}</h2>
    </div>
    <div class="flex-centered justify-content-end flex-wrap gap-3 mt-3">
      <slot name="buttons"></slot>
    </div>
  </div>
</template>
