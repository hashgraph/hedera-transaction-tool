<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { showOpenDialog } from '@renderer/services/electronUtilsService';
import { searchEncryptedKeys, abortFileSearch } from '@renderer/services/encryptedKeys';

import { safeAwait } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';

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
const selectedKeyPaths = ref<string[] | null>(null);
const searching = ref(false);

/* Computed */
const fileNames = computed(() => {
  return (
    foundKeyPaths.value?.map(path => path.split('/').pop()?.split('.').slice(0, -1).join('.')) || []
  );
});

const selectedCount = computed(() => {
  return selectedKeyPaths.value ? selectedKeyPaths.value.length : 0;
});

/* Handlers */
const handleSubmit = (event: Event) => {
  event.preventDefault();
  emit('update:keyPaths', selectedKeyPaths.value);
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
    'Import encrypted keys',
  );

  if (result.canceled) return;

  foundKeyPaths.value = null;

  searching.value = true;

  const { data } = await safeAwait(searchEncryptedKeys(result.filePaths));

  if (data) {
    if (searching.value) {
      foundKeyPaths.value = data;
      selectedKeyPaths.value = data; // Auto-select all items
    } else {
      foundKeyPaths.value = null;
      selectedKeyPaths.value = null;
    }
  }

  searching.value = false;
};

const handleCheckboxChecked = (path: string, checked: boolean) => {
  if (!selectedKeyPaths.value) return;

  if (checked) {
    selectedKeyPaths.value = [...selectedKeyPaths.value, path];
  } else {
    selectedKeyPaths.value = selectedKeyPaths.value.filter(p => p !== path);
  }
};

/* Function */
function reset() {
  abortFileSearch();
  searching.value = false;
  foundKeyPaths.value = null;
  selectedKeyPaths.value = [];
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
      <form @submit="handleSubmit">
        <h3 class="text-center text-title text-bold mt-3">Import encrypted keys</h3>

        <p class="text-center mt-4">
          Select either a folder or a zip file containing the encrypted keys.
        </p>

        <div v-if="foundKeyPaths != null" class="border rounded p-3 mt-4">
          <ul class="overflow-x-hidden" style="max-height: 30vh">
            <li v-for="(path, index) in foundKeyPaths" :key="path">
              <AppCheckBox
                :checked="selectedKeyPaths ? selectedKeyPaths.includes(path) : false"
                @update:checked="handleCheckboxChecked(path, $event)"
                :name="`checkbox-found-key-path-${path}`"
                :label="fileNames[index]"
                :data-testid="`checkbox-found-key-path-${path}`"
              ></AppCheckBox>
            </li>
          </ul>
        </div>

        <p v-if="foundKeyPaths && foundKeyPaths.length > 0" class="text-end mt-2">
          {{ selectedCount }} of {{ foundKeyPaths.length }} key{{ selectedCount > 1 ? 's' : '' }}
          selected
        </p>

        <div class="d-flex justify-content-between mt-4">
          <AppButton
            type="button"
            :color="searching ? 'danger' : 'secondary'"
            :loading="searching"
            :disable-on-loading="false"
            loading-text="Abort Search"
            @click="handleSelect"
            data-testid="button-encrypted-keys-folder-import"
            >Browse</AppButton
          >
          <AppButton
            data-testid="button-import-encrypted-keys"
            :disabled="!foundKeyPaths || foundKeyPaths.length === 0"
            type="submit"
            color="primary"
            >Import</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
