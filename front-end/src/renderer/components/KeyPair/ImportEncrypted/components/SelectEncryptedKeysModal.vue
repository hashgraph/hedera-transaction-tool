<script setup lang="ts">
import { ref, watch } from 'vue';

import { showOpenDialog } from '@renderer/services/electronUtilsService';
import { searchEncryptedKeys, abortFileSearch } from '@renderer/services/encryptedKeys';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  keyPaths: string[] | null;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'update:keyPaths', keyPaths: string[] | null): void;
  (event: 'continue'): void;
}>();

/* State */
const foundKeyPaths = ref<string[] | null>(null);
const searching = ref(false);

/* Handlers */
const handleSubmit = (event: Event) => {
  event.preventDefault();
  emit('update:keyPaths', foundKeyPaths.value);
  emit('continue');
};

const handleClose = (show: boolean) => {
  reset();
  emit('update:keyPaths', null);
  emit('update:show', show);
};

const handleSelect = async () => {
  if (searching.value) {
    reset();
    return;
  }

  const result = await showOpenDialog(
    'Select a folder or a zip file',
    'Select',
    [{ name: 'Zip, PEM or a folder ', extensions: ['zip', 'pem'] }],
    ['openFile', 'openDirectory', 'multiSelections'],
    'Helo',
  );

  if (result.canceled) return;

  foundKeyPaths.value = null;

  try {
    searching.value = true;

    const encryptedKeyPaths = await searchEncryptedKeys(result.filePaths);

    if (searching.value) foundKeyPaths.value = encryptedKeyPaths;
    else foundKeyPaths.value = null;
  } finally {
    searching.value = false;
  }
};

/* Function */
function reset() {
  abortFileSearch();
  searching.value = false;
  foundKeyPaths.value = null;
}

/* Watchers */
watch(
  () => props.show,
  () => reset(),
);
</script>
<template>
  <AppModal
    :show="show"
    @update:show="handleClose"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <i class="bi bi-x-lg cursor-pointer" @click="handleClose(false)"></i>
      <div class="text-center mt-5">
        <i class="bi bi-key large-icon" style="line-height: 16px"></i>
      </div>
      <form @submit="handleSubmit">
        <h3 class="text-center text-title text-bold mt-3">Import encrypted keys</h3>

        <p class="text-center mt-4">
          Select either a folder or a zip file containing the encrypted keys.
        </p>

        <div class="d-grid mt-4">
          <AppButton
            type="button"
            :color="searching ? 'danger' : 'secondary'"
            :loading="searching"
            :disable-on-loading="false"
            loading-text="Abort Search"
            @click="handleSelect"
            data-testid="button-encrypted-keys-folder-import"
            >Select</AppButton
          >
        </div>

        <div v-if="foundKeyPaths != null" class="mt-4">
          <p>
            {{ foundKeyPaths.length }} encrypted key{{ foundKeyPaths.length > 1 ? 's' : '' }} found
          </p>
        </div>

        <hr class="separator my-5" />

        <div class="d-grid">
          <AppButton
            data-testid="button-import-encrypted-keys"
            :disabled="!foundKeyPaths || foundKeyPaths.length === 0"
            type="submit"
            color="primary"
            >Continue</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
