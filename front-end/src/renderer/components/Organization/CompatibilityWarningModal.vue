<script setup lang="ts">
import { computed } from 'vue';

import type { CompatibilityConflict } from '@renderer/services/organization/versionCompatibility';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = withDefaults(
  defineProps<{
    show?: boolean;
    conflicts: CompatibilityConflict[];
    suggestedVersion: string;
    isOptional: boolean; // true if current version still supported, false if mandatory
    triggeringOrgName?: string | null;
  }>(),
  {
    show: false,
    isOptional: true,
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

/* Computed */
const updateMessage = computed(() => {
  return props.isOptional
    ? `has an update available. Version`
    : `requires an update to version`;
});

const conflictMessage = computed(() => {
  if (props.conflicts.length === 0) return '';

  if (props.isOptional) {
    return `You can continue using your current version safely.`;
  } else {
    return `If you choose not to upgrade, you will be disconnected from that organization.`;
  }
});

const modalTitle = computed(() => {
  return props.isOptional
    ? 'Update Compatibility Warning'
    : 'Update Required - Compatibility Warning';
});

const cancelButtonText = computed(() => {
  return props.isOptional ? 'Cancel' : 'Disconnect Organization';
});
</script>
<template>
  <AppModal
    :show="show"
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

      <h2 class="text-title text-semi-bold mt-4 text-center">{{ modalTitle }}</h2>

      <p class="text-small text-secondary mt-3 text-center">
        <span v-if="triggeringOrgName">
          The organization <strong>{{ triggeringOrgName }}</strong> {{ updateMessage }}
          <strong>{{ suggestedVersion }}</strong
          >.
        </span>
        <span v-else>
          An update to version <strong>{{ suggestedVersion }}</strong> is required.
        </span>
      </p>

      <div v-if="conflicts.length > 0" class="mt-4">
        <div class="alert alert-warning" role="alert">
          <p class="text-small mb-0">
            This update may cause issues with other configured organizations. {{ conflictMessage }}
          </p>
        </div>

        <div class="mt-3">
          <p class="text-small text-secondary mb-2"><strong>Conflicting Organizations:</strong></p>
          <ul class="list-unstyled">
            <li
              v-for="conflict in conflicts"
              :key="conflict.serverUrl"
              class="text-small text-secondary mb-2"
            >
              <i class="bi bi-exclamation-circle me-2"></i>
              <strong>{{ conflict.organizationName }}</strong>
              <span v-if="conflict.latestSupportedVersion">
                - Latest supported version: {{ conflict.latestSupportedVersion }}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <hr class="separator my-4" />

      <div class="d-flex gap-4 justify-content-center">
        <AppButton type="button" color="secondary" @click="handleCancel">
          {{ cancelButtonText }}
        </AppButton>
        <AppButton type="button" color="primary" @click="handleProceed">
          <i class="bi bi-download me-2"></i>Proceed with Update
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>
