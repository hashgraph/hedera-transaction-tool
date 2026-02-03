<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';

defineProps<{
  errorMessage: {
    title: string;
    message: string;
    action: string;
  };
  cancelLabel?: string;
}>();

const emit = defineEmits<{
  (event: 'cancel'): void;
  (event: 'retry'): void;
}>();

const handleCancel = () => emit('cancel');
const handleRetry = () => emit('retry');
</script>

<template>
  <div class="text-center p-4">
    <div>
      <i class="bi bi-exclamation-triangle-fill text-danger" style="font-size: 4rem"></i>
    </div>
    <h2 class="text-title text-semi-bold mt-4">{{ errorMessage.title }}</h2>
    <p class="text-small text-secondary mt-3">
      {{ errorMessage.message }}<br />
      {{ errorMessage.action }}
    </p>
    <hr class="separator my-4" />
    <div class="d-flex gap-4 justify-content-center">
      <AppButton type="button" color="secondary" @click="handleCancel">
        {{ cancelLabel || 'Cancel' }}
      </AppButton>
      <AppButton type="button" color="primary" @click="handleRetry">
        <i class="bi bi-arrow-repeat me-2"></i>Try Again
      </AppButton>
    </div>
  </div>
</template>
