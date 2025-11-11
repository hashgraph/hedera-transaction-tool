<script setup lang="ts">
import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { showOpenDialog } from '@renderer/services/electronUtilsService';
import { searchPublicKeys, abortFileSearch } from '@renderer/services/publicKeyMappingService';
import { getErrorMessage, getPublicKeyMapping, safeAwait } from '@renderer/utils';
import { useToast } from 'vue-toast-notification';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import PublicKeysBox from './PublicKeysBox.vue';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Props */
const props = defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const foundKeys = ref<{ publicKey: string; nickname: string }[]>([]);
const selectedKeys = ref<{ publicKey: string; nickname: string }[]>([]);
const searching = ref(false);

/* Handlers */
const handleSubmit = async () => {
  try {
    const existingMappingsResults = await Promise.allSettled(
      selectedKeys.value.map(k => getPublicKeyMapping(k.publicKey)),
    );

    const existingKeys = new Set(
      existingMappingsResults
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(
          r =>
            (r as PromiseFulfilledResult<{ id: string; public_key: string; nickname: string }>)
              .value.public_key,
        ),
    );

    const newKeys = selectedKeys.value.filter(k => !existingKeys.has(k.publicKey));
    const skippedKeys = selectedKeys.value.length - newKeys.length;

    await Promise.allSettled(newKeys.map(k => user.storePublicKeyMapping(k.publicKey, k.nickname)));

    if (skippedKeys === selectedKeys.value.length) {
      toast.error('All selected keys are already imported in your list');
    } else if (skippedKeys > 0) {
      toast.success(
        `${skippedKeys} of the selected keys were already in your list. The rest were imported successfully.`,
        successToastOptions
      );
    } else {
      toast.success(`Public key(s) imported successfully`, successToastOptions);
    }

    handleClose(false);
  } catch (error) {
    toast.error(getErrorMessage(error, `Failed to import public key(s)`));
  }
};

const handleClose = (show: boolean) => {
  reset();
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
    [{ name: 'Zip, PUB or a folder ', extensions: ['zip', 'pub'] }],
    ['openFile', 'openDirectory', 'multiSelections'],
    'Import public keys',
  );

  if (result.canceled) return;

  foundKeys.value = [];
  selectedKeys.value = [];

  searching.value = true;

  const { data } = await safeAwait(searchPublicKeys(result.filePaths));

  if (data) {
    if (searching.value) {
      foundKeys.value = data;
      selectedKeys.value = data;
    } else {
      foundKeys.value = [];
      selectedKeys.value = [];
    }
  }

  searching.value = false;
};

/* Function */
function reset() {
  abortFileSearch();
  searching.value = false;
  foundKeys.value = [];
  selectedKeys.value = [];
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
      <div class="text-center mt-4">
        <i class="bi bi-key large-icon"></i>
      </div>
      <form @submit.prevent="handleSubmit">
        <h3 class="text-center text-title text-bold mt-3">Import public keys</h3>

        <p class="text-center mt-4">
          Select either a folder or a zip file containing the public keys.
        </p>

        <PublicKeysBox
          v-if="foundKeys.length"
          :keys="foundKeys"
          :selectedKeys="selectedKeys || []"
          @update:selectedKeys="selectedKeys = $event"
        />

        <div class="d-flex justify-content-between mt-4">
          <AppButton
            type="button"
            :color="searching ? 'danger' : 'secondary'"
            :loading="searching"
            :disable-on-loading="false"
            loading-text="Abort Search"
            @click="handleSelect"
            data-testid="button-public-keys-folder-import"
            >Browse</AppButton
          >
          <AppButton
            data-testid="button-import-files-public"
            :disabled="selectedKeys.length === 0"
            type="submit"
            color="primary"
            >Import</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
