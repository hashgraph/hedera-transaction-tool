<script setup lang="ts">
import type { CompatibilityConflict } from '@renderer/services/organization/versionCompatibility';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = withDefaults(
  defineProps<{
    show: boolean;
    title: string;
    summaryText: string;
    warningText?: string;
    conflicts: CompatibilityConflict[];
    conflictsTitle?: string;
    proceedLabel?: string;
    cancelLabel?: string;
  }>(),
  {
    show: false,
    warningText: '',
    conflictsTitle: 'Affected Organizations',
    proceedLabel: 'Proceed',
    cancelLabel: 'Cancel',
  },
);

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'proceed'): void;
  (event: 'cancel'): void;
}>();

/* Handlers */
const handleProceed = () => {
  emit('proceed');
  emit('update:show', false);
};

const handleCancel = () => {
  emit('cancel');
  emit('update:show', false);
};
</script>
<template>
  <AppModal
    :show="props.show"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="modal-fit-content"
  >
    <div class="p-4">
      <div class="d-flex justify-content-end mb-2">
        <i class="bi bi-x-lg cursor-pointer" @click="handleCancel"></i>
      </div>

      <div class="text-center">
        <i class="bi bi-exclamation-triangle-fill text-warning" style="font-size: 4rem"></i>
      </div>

      <h2 class="text-title text-semi-bold mt-4 text-center">{{ props.title }}</h2>

      <p class="text-small text-secondary mt-3 text-center">{{ props.summaryText }}</p>

      <div v-if="props.conflicts.length > 0 || Boolean(props.warningText)" class="mt-4">
        <div class="alert alert-warning" role="alert">
          <p class="text-small mb-0">{{ props.warningText }}</p>
        </div>

        <div v-if="props.conflicts.length > 0" class="mt-3">
          <p class="text-small text-secondary mb-2"><strong>{{ props.conflictsTitle }}:</strong></p>
          <ul class="list-unstyled">
            <li
              v-for="conflict in props.conflicts"
              :key="conflict.serverUrl"
              class="text-small text-secondary mb-2"
            >
              <i class="bi bi-exclamation-circle me-2"></i>
              <strong>{{ conflict.organizationName }}</strong>
              <span v-if="Boolean(conflict.latestSupportedVersion)">
                - Latest supported version: {{ conflict.latestSupportedVersion }}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <hr class="separator my-4" />

      <div class="d-flex gap-4 justify-content-center">
        <AppButton type="button" color="secondary" @click="handleCancel">
          {{ props.cancelLabel }}
        </AppButton>
        <AppButton type="button" color="primary" @click="handleProceed">
          <i class="bi bi-download me-2"></i>{{ props.proceedLabel }}
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>
