<script setup lang="ts">
import { ref, watch } from 'vue';
import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';
import AppCustomIcon, { type CustomIcon } from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const activate = defineModel<boolean>('activate', { required: true });
const props = defineProps<{
  actionCallback: () => Promise<void>;
  confirmTitle: string;
  confirmText: string;
  progressIconName: CustomIcon;
  progressTitle: string;
  progressText: string;
}>();

/* State */
const isConfirmModalShown = ref(false);
const isActionOnGoing = ref(false);

/* Handlers */
const handleConfirm = async () => {
  isActionOnGoing.value = true;
  try {
    await props.actionCallback();
  } finally {
    isActionOnGoing.value = false;
    activate.value = false;
  }
};

const handleCancel = () => {
  activate.value = false;
};

/* Hooks */
watch(activate, () => {
  if (activate.value) {
    isConfirmModalShown.value = true;
  }
});
</script>

<template>
  <AppConfirmModal
    v-model:show="isConfirmModalShown"
    :title="props.confirmTitle"
    :text="props.confirmText"
    :callback="handleConfirm"
    :cancel="handleCancel"
  />

  <AppModal
    :show="isActionOnGoing"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="small-modal"
  >
    <div class="p-4">
      <div class="text-center">
        <AppCustomIcon :name="props.progressIconName" style="height: 80px" />
      </div>
      <h3 class="text-center text-title text-bold mt-4">{{ props.progressTitle }}</h3>
      <p class="text-center text-small text-secondary mt-4 mb-4">{{ props.progressText }}</p>
      <p class="text-center text-small text-secondary mt-6 mb-4">
        <span class="spinner-border me-2" role="status" inert></span>{{ ' ' }}
      </p>
    </div>
  </AppModal>
</template>

<style scoped></style>
