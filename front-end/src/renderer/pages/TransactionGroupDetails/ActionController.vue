<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';
import AppCustomIcon, { type CustomIcon } from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

const dohertyThreshold = 400; // milliseconds
const persistenceTime = dohertyThreshold * 3;

/* Props */
const activate = defineModel<boolean>('activate', { required: true });
const props = defineProps<{
  actionCallback: () => Promise<void>;
  confirmTitle?: string;
  confirmText?: string;
  progressIconName: CustomIcon;
  progressTitle: string;
  progressText: string;
  dataTestid?: string;
}>();

/* State */
const isConfirmModalShown = ref(false);
const startDate = ref<Date | null>(null);
const timeoutID = ref<number | null>(null);
const showProgress = ref<boolean>(false);

/* Computed */
const confirmationProps = computed(() => {
  const { confirmTitle, confirmText, dataTestid } = props;
  if (confirmTitle !== undefined && confirmText !== undefined && dataTestid !== undefined) {
    return { confirmTitle, confirmText, dataTestid };
  }
  return null;
});

/* Handlers */
const handleConfirm = async () => {
  await performAction();
};

const handleCancel = () => {
  activate.value = false;
};

/* Functions */
const performAction = async () => {
  document.documentElement.inert = true; // Before Doherty threshold, we render document inert
  startDate.value = new Date();
  timeoutID.value = window.setTimeout(() => {
    document.documentElement.inert = false;
    timeoutID.value = null;
    showProgress.value = true;
  }, dohertyThreshold);
  try {
    await props.actionCallback();
    if (showProgress.value) {
      // Progress dialog is visible.
      // We make sure it's visible long enough for the user to identify it.
      const elapsedTime = Date.now() - startDate.value.getTime();
      const waitingTime = dohertyThreshold + persistenceTime - elapsedTime;
      if (waitingTime > 0) {
        // => elapsedTime < dohertyThreshold + visibleMinTime
        console.log('Waiting for ' + waitingTime + ' ms');
        await new Promise(resolve => setTimeout(resolve, waitingTime));
      }
    }
  } finally {
    showProgress.value = false;
    document.documentElement.inert = false;
    if (timeoutID.value !== null) {
      clearTimeout(timeoutID.value);
      timeoutID.value = null;
    }
    startDate.value = null;
    activate.value = false;
  }
};

/* Hooks */
watch(activate, async () => {
  if (activate.value) {
    if (confirmationProps.value) {
      isConfirmModalShown.value = true;
    } else {
      await performAction();
    }
  }
});
</script>

<template>
  <AppConfirmModal
    v-if="confirmationProps"
    v-model:show="isConfirmModalShown"
    :title="confirmationProps.confirmTitle"
    :text="confirmationProps.confirmText"
    :callback="handleConfirm"
    :cancel="handleCancel"
    :data-testid="confirmationProps.dataTestid"
  />

  <AppModal
    v-model:show="showProgress"
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
