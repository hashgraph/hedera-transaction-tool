<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { ToastManager } from '@renderer/utils/ToastManager';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import useStoreExternalKeyPair from '@renderer/composables/useStoreExternalKeyPair';

import {
  detectPrivateKeyType,
  generateExternalKeyPairFromString,
  verifyKeyPair,
} from '@renderer/services/keyPairService';

import { assertUserLoggedIn, getErrorMessage } from '@renderer/utils';
import { createLogger } from '@renderer/utils/logger';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppSelect from '@renderer/components/ui/AppSelect.vue';

type KeyTypeName = 'ED25519' | 'ECDSA';

const logger = createLogger('renderer.component.importExternalPrivateKeyModal');

/* Props */
const props = defineProps<{
  show: boolean;
  /** Known type (e.g. when restoring a key for a known public key); hides the type dropdown */
  keyType?: 'ED25519' | 'ECDSA';
  publicKey?: string;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Stores */
const user = useUserStore();

/* Composables */
const toastManager = ToastManager.inject();
const { getPassword, passwordModalOpened } = usePersonalPassword();
const storeExternalKeyPair = useStoreExternalKeyPair();

/* State */
const keyTypeItems: { label: string; value: KeyTypeName | null }[] = [
  { label: 'ED25519', value: 'ED25519' },
  { label: 'ECDSA', value: 'ECDSA' },
];
const key = reactive<{ privateKey: string; nickname?: string }>({
  privateKey: '',
});
const selectedKeyType = ref<KeyTypeName | null>(null);
// True while the selection was filled in by detection (so it can follow the pasted key)
const isAutoSelected = ref(false);

/* Computed */
const detectedKeyType = computed(() => detectPrivateKeyType(key.privateKey));

const resolvedKeyType = computed<KeyTypeName | null>(
  () => props.keyType ?? selectedKeyType.value,
);

const hasTypeMismatch = computed(
  () =>
    !props.keyType &&
    selectedKeyType.value !== null &&
    detectedKeyType.value !== null &&
    detectedKeyType.value !== selectedKeyType.value,
);

const typeMessage = computed(() => {
  if (props.keyType || key.privateKey.trim() === '') return null;
  if (hasTypeMismatch.value) {
    return `Pasted key is ${detectedKeyType.value}, not ${selectedKeyType.value}.`;
  }
  if (selectedKeyType.value === null) {
    return 'Key type not detected. Select one.';
  }
  return null;
});

const canImport = computed(
  () => key.privateKey.trim() !== '' && resolvedKeyType.value !== null && !hasTypeMismatch.value,
);

/* Handlers */
const handleImportExternalKey = async () => {
  assertUserLoggedIn(user.personal);

  const type = resolvedKeyType.value;
  if (type === null || hasTypeMismatch.value) return;

  const personalPassword = getPassword(handleImportExternalKey, {
    subHeading: 'Private key/s will be encrypted with this password',
  });
  if (passwordModalOpened(personalPassword)) return;

  try {
    if (props.publicKey && !verifyKeyPair(props.publicKey, key.privateKey)) {
      throw new Error('The private key does not match the public key');
    }

    const keyPair = generateExternalKeyPairFromString(
      key.privateKey.trim(),
      type,
      key.nickname || '',
    );
    await storeExternalKeyPair(keyPair, type, personalPassword);

    logger.info('Private key imported', {
      keyType: type,
      publicKey: keyPair.public_key,
      keyTypeWasSelected: selectedKeyType.value !== null && !isAutoSelected.value,
      restoringKnownPublicKey: Boolean(props.publicKey),
    });

    emit('update:show', false);

    toastManager.success(`${type} private key imported successfully`);
  } catch (error) {
    logger.error('Failed to import private key', {
      keyType: type,
      restoringKnownPublicKey: Boolean(props.publicKey),
      error,
    });
    toastManager.error(getErrorMessage(error, `Failed to import ${type} private key`));
  }
};

const handleKeyTypeSelected = (value: KeyTypeName | null) => {
  selectedKeyType.value = value;
  isAutoSelected.value = false;
};

/* Watchers */
watch(detectedKeyType, detected => {
  // Fill in the type from the pasted key unless the user chose one themselves
  if (selectedKeyType.value === null || isAutoSelected.value) {
    selectedKeyType.value = detected;
    isAutoSelected.value = detected !== null;
  }
});

watch(
  () => props.show,
  () => {
    key.privateKey = '';
    key.nickname = '';
    selectedKeyType.value = null;
    isAutoSelected.value = false;
  },
);
</script>

<template>
  <AppModal
    v-if="show"
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
      <form @submit.prevent="handleImportExternalKey">
        <div v-if="props.publicKey" class="form-group mt-4">
          <label class="form-label">Public Key</label>
          <p data-testid="label-public-key" class="d-inline-block text-truncate w-100">
            {{ props.publicKey }}
          </p>
        </div>
        <div v-if="!props.keyType" class="form-group mt-4">
          <label class="form-label">Key Type</label>
          <AppSelect
            :value="selectedKeyType"
            @update:value="handleKeyTypeSelected"
            :items="keyTypeItems"
            toggle-text="Select key type"
            toggler-icon
            size="small"
            button-class="w-100"
            class="w-100"
            data-testid="select-private-key-type"
          />
        </div>
        <div class="form-group mt-4">
          <label class="form-label">Enter {{ resolvedKeyType || '' }} Private key</label>
          <AppInput
            v-model="key.privateKey"
            size="small"
            name="private-key"
            :filled="true"
            placeholder="Type Private key"
            data-testid="input-private-key"
          />
          <div
            v-if="typeMessage"
            class="text-small text-danger mt-2"
            data-testid="label-key-type-message"
          >
            {{ typeMessage }}
          </div>
        </div>
        <div class="form-group mt-4">
          <label class="form-label">Enter nickname (optional)</label>
          <AppInput
            v-model="key.nickname"
            size="small"
            name="nickname"
            :filled="true"
            placeholder="Type nickname"
            data-testid="input-private-key-nickname"
          />
        </div>

        <hr class="separator my-5" />

        <div class="d-grid">
          <AppButton
            data-testid="button-private-key-import"
            type="submit"
            color="primary"
            :disabled="!canImport"
            >Import</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
