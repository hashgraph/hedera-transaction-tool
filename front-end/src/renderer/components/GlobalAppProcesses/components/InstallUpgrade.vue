<!-- language: vue -->
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

const props = defineProps<{
  version?: string;
  isInstalling: boolean;
  cancelLabel?: string;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'install'): void;
  (e: 'confirm-install'): void;
}>();

const countdown = ref(5);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const handleCancel = () => emit('cancel');
const handleInstall = () => emit('install');

watch(
  () => props.isInstalling,
  (installing) => {
    if (installing) {
      countdown.value = 5;
      countdownTimer = setInterval(() => {
        countdown.value--;
        if (countdown.value <= 0) {
          if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
          }
          emit('confirm-install');
        }
      }, 1000);
    } else {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
});
</script>

<template>
  <div class="text-center p-4" v-if="isInstalling">
    <div>
      <i class="bi bi-arrow-clockwise spinning" style="font-size: 4rem; color: var(--bs-primary)"></i>
    </div>
    <h2 class="text-title text-semi-bold mt-4">Installing Update...</h2>
    <p class="text-small text-secondary mt-3">
      The application will close and restart automatically.<br />
      This may take several minutes.<br />
      Please do not reopen the application or restart your computer during installation.
    </p>
    <p class="text-small text-secondary mt-2">
      Closing in {{ countdown }} second{{ countdown !== 1 ? 's' : '' }}...
    </p>
  </div>
  <div class="text-center p-4" v-else>
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

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spinning {
  display: inline-block;
  animation: spin 1s linear infinite;
}
</style>
