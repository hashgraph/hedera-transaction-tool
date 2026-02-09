<script setup lang="ts">
import AppProgressBar from '@renderer/components/ui/AppProgressBar.vue';
import { formatProgressBytes } from '@renderer/utils';
import AppButton from '@renderer/components/ui/AppButton.vue';

type Progress = {
  transferred: number;
  total: number;
  bytesPerSecond: number;
  percent?: number;
};

defineProps<{
  version?: string;
  progress: Progress | null;
  progressLabel: string;
  cancelLabel?: string;
}>();

const emit = defineEmits<{
  (event: 'cancel'): void;
}>();

const handleCancel = () => emit('cancel');
</script>

<template>
  <div class="text-center p-4">
    <div>
      <i class="bi bi-download text-primary" style="font-size: 4rem"></i>
    </div>
    <h2 class="text-title text-semi-bold mt-4">Downloading Update</h2>
    <p class="text-small text-secondary mt-3" v-if="version">
      Version {{ version }}
    </p>
    <div class="d-grid mt-4" v-if="progress">
      <div class="d-flex justify-content-between">
        <p class="text-start text-footnote mt-3">
          {{ formatProgressBytes(progress.transferred) }}
          of
          {{ formatProgressBytes(progress.total) }}
        </p>
        <p class="text-start text-micro mt-3">
          {{ formatProgressBytes(progress.bytesPerSecond, '') }}/s
        </p>
      </div>
      <AppProgressBar
        :percent="Number(progress.percent?.toFixed(2)) || 0"
        :label="progressLabel"
        :height="18"
        class="mt-2"
      />
    </div>
    <hr class="separator my-4" />
    <div class="d-flex gap-4 justify-content-center">
      <AppButton type="button" color="secondary" @click="handleCancel">
        {{ cancelLabel || 'Cancel' }}
      </AppButton>
    </div>
  </div>
</template>
