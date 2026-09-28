<script setup lang="ts">
import { ToastManager } from '@renderer/utils/ToastManager';

const toastManager = ToastManager.inject();

const dismiss = (toastId: number) => {
  toastManager.removeEntry(toastId);
};

/*
    https://getbootstrap.com/docs/5.0/components/toasts/
    https://blog.openreplay.com/vue-toast-notifications/
 */
</script>

<template>
  <div class="toast-container position-fixed bottom-0 end-0 p-5">
    <div
      v-for="e in toastManager.entries.value"
      :key="e.toastId"
      :class="['toast', 'show', 'toast-' + e.type]"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      @click.stop="dismiss(e.toastId)"
    >
      <div class="toast-header">
        <span class="me-auto toast-message">{{ e.message }}</span>
        <button
          v-if="e.type === 'error'"
          type="button"
          class="btn-close"
          aria-label="Close"
        />
      </div>
    </div>
  </div>
</template>

<style scoped></style>
