<script setup lang="ts">
import { onMounted, ref } from 'vue';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from './ui/AppButton.vue';

/* Misc */
const localStorageItemName = 'important-note-accepted';

/* State */
const shown = ref(true);

/* Handlers */
const handleAccept = () => {
  localStorage.setItem(localStorageItemName, 'true');
  shown.value = false;
};

/* Hooks */
onMounted(() => {
  const importantNoteAccepted = JSON.parse(localStorage.getItem(localStorageItemName) || 'false');

  shown.value = !importantNoteAccepted;
});
</script>
<template>
  <AppModal
    v-model:show="shown"
    class="large-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="rounded bottom-0 end-50 user-select-none bg-modal-surface p-4">
      <h2 class="text-center text-headline mt-0">Important Note</h2>
      <hr class="mt-2 mb-3" />
      <p>
        This software is designed for use solely by the Hedera Council and staff. The software is
        being released as open source as example code only, and is not intended or suitable for use
        in its current form by anyone other than members of the Hedera Council and Hedera personnel.
        If you are not a Hedera Council member or staff member, use of this application or of the
        code in its current form is not recommended and is at your own risk.
      </p>
      <div class="mt-5 text-center">
        <AppButton :outline="true" color="primary" @click="handleAccept"
          >I Understand and Agree</AppButton
        >
      </div>
    </div>
  </AppModal>
</template>
