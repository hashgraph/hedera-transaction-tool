<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';
import AppCustomIcon, { type CustomIcon } from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import ActionReportModal from './ActionReportModal.vue';
import usePersonalPassword from '@renderer/composables/usePersonalPassword.ts';
import { makeUncontrolledErrorReport, type ActionReport } from './ActionReport';

const dohertyThreshold = 400; // milliseconds
const persistenceTime = dohertyThreshold * 3;

/* Props */
const activate = defineModel<boolean>('activate', { required: true });
const props = withDefaults(
  defineProps<{
    actionCallback: (personalPassword: string | null) => Promise<ActionReport | null>;
    confirmTitle?: string;
    confirmText?: string;
    actionButtonText?: string;
    cancelButtonText?: string;
    personalPasswordRequired?: boolean;
    progressIconName?: CustomIcon | null;
    progressTitle: string;
    progressText: string;
    dataTestid?: string;
  }>(),
  {
    actionButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    personalPasswordRequired: false,
    progressIconName: null,
  },
);

/* Composables */
const { getPasswordAsync } = usePersonalPassword();

/* State */
const isConfirmModalShown = ref(false);
const startDate = ref<Date | null>(null);
const timeoutID = ref<number | null>(null);
const showProgress = ref<boolean>(false);
const showReport = ref<boolean>(false);
const report = ref<ActionReport | null>(null);

/* Computed */
const confirmationProps = computed(() => {
  const { confirmTitle, confirmText, dataTestid, actionButtonText, cancelButtonText } = props;
  if (confirmTitle !== undefined && confirmText !== undefined && dataTestid !== undefined) {
    return { confirmTitle, confirmText, dataTestid, actionButtonText, cancelButtonText };
  }
  return null;
});

/* Handlers */
const handleConfirm = async () => {
  if (props.personalPasswordRequired) {
    const pp = await getPasswordAsync({
      subHeading: 'Enter your application password to decrypt your private key',
    });
    if (pp === false) {
      // User cancelled action
      handleCancel();
    } else {
      await performAction(pp);
    }
  } else {
    await performAction(null);
  }
};

const handleCancel = () => {
  activate.value = false;
};

/* Functions */
const performAction = async (personalPassword: string | null) => {
  document.documentElement.inert = true; // Before Doherty threshold, we render document inert
  startDate.value = new Date();
  timeoutID.value = window.setTimeout(() => {
    document.documentElement.inert = false;
    timeoutID.value = null;
    showProgress.value = true;
  }, dohertyThreshold);
  try {
    report.value = await props.actionCallback(personalPassword);
    if (showProgress.value) {
      // Progress dialog is visible.
      // We make sure it's visible long enough for the user to identify it.
      const elapsedTime = Date.now() - startDate.value.getTime();
      const waitingTime = dohertyThreshold + persistenceTime - elapsedTime;
      if (waitingTime > 0) {
        // => elapsedTime < dohertyThreshold + visibleMinTime
        await new Promise(resolve => setTimeout(resolve, waitingTime));
      }
    }
  } catch (error) {
    report.value = makeUncontrolledErrorReport(error);
  } finally {
    showProgress.value = false;
    document.documentElement.inert = false;
    if (timeoutID.value !== null) {
      clearTimeout(timeoutID.value);
      timeoutID.value = null;
    }
    startDate.value = null;
    if (report.value !== null) {
      showReport.value = true;
    } else {
      activate.value = false;
    }
  }
};

/* Hooks */
watch(activate, async () => {
  if (activate.value) {
    if (confirmationProps.value) {
      isConfirmModalShown.value = true;
    } else {
      await handleConfirm();
    }
  }
});
watch(showReport, () => {
  if (!showReport.value) {
    activate.value = false;
  }
})
</script>

<template>
  <AppConfirmModal
    v-if="confirmationProps"
    v-model:show="isConfirmModalShown"
    :button-text="confirmationProps.actionButtonText"
    :callback="handleConfirm"
    :cancel="handleCancel"
    :cancel-button-text="confirmationProps.cancelButtonText"
    :data-testid="confirmationProps.dataTestid"
    :text="confirmationProps.confirmText"
    :title="confirmationProps.confirmTitle"
  />

  <AppModal
    v-model:show="showProgress"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="small-modal"
  >
    <div class="p-4">
      <div class="text-center">
        <i v-if="props.progressIconName === null" class="bi bi-arrow-left-right large-icon"></i>
        <AppCustomIcon v-else :name="props.progressIconName" style="height: 80px" />
      </div>
      <h3 class="text-center text-title text-bold mt-4">{{ props.progressTitle }}</h3>
      <p class="text-center text-small text-secondary mt-4 mb-4">{{ props.progressText }}</p>
      <p class="text-center text-small text-secondary mt-6 mb-4">
        <span class="spinner-border me-2" inert role="status"></span>{{ ' ' }}
      </p>
    </div>
  </AppModal>

  <ActionReportModal v-if="report !== null" v-model:show="showReport" :report="report" />
</template>

<style scoped></style>
