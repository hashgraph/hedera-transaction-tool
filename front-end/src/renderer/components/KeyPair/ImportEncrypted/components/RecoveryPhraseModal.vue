<script setup lang="ts">
import useUserStore from '@renderer/stores/storeUser';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import Import from '@renderer/pages/AccountSetup/components/Import.vue';

/* Props */
defineProps<{
  show: boolean;
  mnemonic: string[] | null;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'update:mnemonic', mnemonic: string[] | null): void;
  (event: 'continue'): void;
}>();

/* Stores */
const user = useUserStore();

/* Handlers */
const handleSubmit = (event: Event) => {
  event.preventDefault();
  if (!user.recoveryPhrase) throw new Error('Recovery phrase is required');
  emit('update:mnemonic', user.recoveryPhrase.words);
  emit('continue');
};

const handleSkip = () => {
  emit('update:mnemonic', null);
  emit('continue');
};

const handleClose = (show: boolean) => {
  emit('update:mnemonic', null);
  emit('update:show', show);
};

/* Handlers */
const handleClearWords = () => {
  user.recoveryPhrase = null;
};
</script>
<template>
  <AppModal
    :show="show"
    @update:show="handleClose"
    class="large-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <i class="bi bi-x-lg cursor-pointer" @click="handleClose(false)"></i>
      <div class="text-center mt-4">
        <i class="bi bi-key large-icon" style="line-height: 16px"></i>
      </div>
      <form @submit="handleSubmit">
        <h3 class="text-center text-title text-bold mt-3">Import recovery phrase (Optional)</h3>

        <p class="text-center mt-4">
          The keys matching this recovery phrase will be stored with index and mnemonic hash.
        </p>

        <p class="text-center">You may skip this step and all keys will be marked as external</p>

        <Import class="mt-4" />

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4 overflow-hidden">
          <AppButton color="borderless" type="button" class="min-w-unset" @click="handleClearWords"
            >Clear</AppButton
          >
          <div class="flex-between-centered gap-4">
            <AppButton color="secondary" type="button" @click="handleSkip">Skip</AppButton>
            <AppButton color="primary" type="submit" :disabled="!user.recoveryPhrase"
              >Import</AppButton
            >
          </div>
        </div>
      </form>
    </div>
  </AppModal>
</template>
