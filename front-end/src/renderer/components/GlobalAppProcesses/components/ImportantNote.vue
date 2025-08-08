<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { LOCAL_STORAGE_IMPORTANT_NOTE_ACCEPTED } from '@shared/constants';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Emits */
const emit = defineEmits<{
  (event: 'ready'): void;
}>();

/* State */
const shown = ref(true);

/* Handlers */
const handleAccept = () => {
  localStorage.setItem(LOCAL_STORAGE_IMPORTANT_NOTE_ACCEPTED, 'true');
  shown.value = false;
  emit('ready');
};

/* Functions */
const initialize = () => {
  const importantNoteAccepted = JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_IMPORTANT_NOTE_ACCEPTED) || 'false',
  );

  shown.value = !importantNoteAccepted;

  if (importantNoteAccepted) {
    emit('ready');
  }
};

/* Hooks */
onMounted(initialize);

/* Expose */
defineExpose({ initialize });
</script>
<template>
  <AppModal
    v-model:show="shown"
    class="large-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="rounded bottom-0 end-50 user-select-none bg-modal-surface p-5">
      <h2 class="text-center text-headline text-bold mt-0">
        <i class="bi bi-exclamation-triangle-fill me-3"></i> Important note
      </h2>

      <p class="text-small text-secondary mt-4">
        This software is designed for use solely by the Hedera Council and staff. The software is
        being released as open source as example code only, and is not intended or suitable for use
        in its current form by anyone other than members of the Hedera Council and Hedera personnel.
        If you are not a Hedera Council member or staff member, use of this application or of the
        code in its current form is not recommended and is at your own risk.
      </p>
      <div class="mt-5 text-center">
        <AppButton data-testid="button-understand-agree" color="primary" @click="handleAccept"
          >I Understand and Agree</AppButton
        >
      </div>
    </div>
  </AppModal>
</template>
