<script setup lang="ts">
import { ref, watch } from 'vue';

import { showOpenDialog } from '@renderer/services/electronUtilsService';
import { searchEncryptedKeys } from '@renderer/services/encryptedKeys';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = defineProps<{
  show: boolean;
}>();

/* Emits */
defineEmits(['update:show']);

/* State */
const searching = ref(false);
const foundKeys = ref<string[] | null>(null);

/* Handlers */
const handleSubmit = (event: Event) => {
  event.preventDefault();
};

const handleSelect = async () => {
  const result = await showOpenDialog(
    'Select a folder or a zip file',
    'Select',
    [{ name: 'Zip, PEM or a folder ', extensions: ['zip', 'pem'] }],
    ['openFile', 'openDirectory', 'multiSelections'],
    'Helo',
  );

  if (result.canceled) return;

  try {
    searching.value = true;
    foundKeys.value = await searchEncryptedKeys(result.filePaths);
  } finally {
    searching.value = false;
  }
};

/* Watchers */
watch(
  () => props.show,
  () => {},
);
</script>
<template>
  <AppModal
    :show="show"
    @update:show="$emit('update:show', $event)"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
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
            color="secondary"
            :disabled="searching"
            :loading="searching"
            loading-text="Searching..."
            @click="handleSelect"
            data-testid="button-encrypted-keys-folder-import"
            >Select</AppButton
          >
        </div>

        <div v-if="foundKeys != null" class="mt-4">
          <p>{{ foundKeys.length }} encrypted key{{ foundKeys.length > 1 ? 's' : '' }} found</p>
        </div>

        <hr class="separator my-5" />

        <div class="d-grid">
          <AppButton
            data-testid="button-import-encrypted-keys"
            :disabled="!foundKeys || foundKeys.length === 0"
            type="submit"
            color="primary"
            >Continue</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
