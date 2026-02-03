<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';

defineProps<{
  latestVersion: string | null;
  cancelLabel?: string;
}>();

const emit = defineEmits<{
  (event: 'cancel'): void;
  (event: 'update'): void;
}>();

const handleCancel = () => emit('cancel');
const handleUpdate = () => emit('update');
</script>

<template>
  <div class="text-center p-4">
    <div>
      <i class="bi bi-arrow-up-circle-fill text-primary" style="font-size: 4rem"></i>
    </div>
    <h2 class="text-title text-semi-bold mt-4">Update Available</h2>
    <p class="text-small text-secondary mt-3">
      A new version <span v-if="latestVersion" class="text-bold">({{ latestVersion }})</span> is
      available.<br />
      Would you like to update now?
    </p>
    <hr class="separator my-4" />
    <div class="d-flex gap-4 justify-content-center">
      <AppButton type="button" color="secondary" @click="handleCancel">
        {{ cancelLabel || 'Cancel' }}
      </AppButton>
      <AppButton type="button" color="primary" @click="handleUpdate">
        <i class="bi bi-download me-2"></i>Update Now
      </AppButton>
    </div>
  </div>
</template>
