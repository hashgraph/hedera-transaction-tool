<!-- language: vue -->
<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';

defineProps<{
  version?: string;
  isInstalling: boolean;
  cancelLabel?: string;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'install'): void;
}>();

const handleCancel = () => emit('cancel');
const handleInstall = () => emit('install');
</script>

<template>
  <div class="text-center p-4">
    <div>
      <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem"></i>
    </div>
    <h2 class="text-title text-semi-bold mt-4">Update Ready to Install</h2>
    <p class="text-small text-secondary mt-3" v-if="version">
      Version {{ version }} has been downloaded.<br />
      The application will restart to install the update.
    </p>
    <hr class="separator my-4" />
    <div class="d-flex gap-4 justify-content-center">
      <AppButton
        type="button"
        color="secondary"
        :disabled="isInstalling"
        @click="handleCancel"
      >
        {{ cancelLabel || 'Cancel' }}
      </AppButton>
      <AppButton
        type="button"
        color="primary"
        :disabled="isInstalling"
        @click="handleInstall"
      >
        <i class="bi bi-arrow-clockwise me-2"></i>Install & Restart
      </AppButton>
    </div>
  </div>
</template>
