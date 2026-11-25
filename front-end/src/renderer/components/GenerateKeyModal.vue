<script lang="ts">
// Module scope: remembered across openings of the modal for the app session only (not persisted)
let lastSelectedKeyType: 'ED25519' | 'ECDSA' = 'ED25519';
</script>

<script setup lang="ts">
import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { ToastManager } from '@renderer/utils/ToastManager';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import useStoreExternalKeyPair from '@renderer/composables/useStoreExternalKeyPair';

import { generateRandomKeyPair } from '@renderer/services/keyPairService';

import { assertUserLoggedIn, getErrorMessage } from '@renderer/utils';
import { createLogger } from '@renderer/utils/logger';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppSelect from '@renderer/components/ui/AppSelect.vue';

const logger = createLogger('renderer.component.generateKeyModal');

/* Props */
const props = defineProps<{
  show: boolean;
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
const keyTypeItems: { label: string; value: 'ED25519' | 'ECDSA' }[] = [
  { label: 'ED25519', value: 'ED25519' },
  { label: 'ECDSA', value: 'ECDSA' },
];

const keyType = ref<'ED25519' | 'ECDSA'>(lastSelectedKeyType);
const nickname = ref('');

/* Handlers */
const handleGenerate = async () => {
  assertUserLoggedIn(user.personal);
  const personalPassword = getPassword(handleGenerate, {
    subHeading: 'Private key will be encrypted with this password',
  });
  if (passwordModalOpened(personalPassword)) return;

  try {
    const keyPair = generateRandomKeyPair(keyType.value, nickname.value);
    await storeExternalKeyPair(keyPair, keyType.value, personalPassword);

    logger.info('Random key generated', {
      keyType: keyType.value,
      publicKey: keyPair.public_key,
    });

    emit('update:show', false);
    toastManager.success(`${keyType.value} key generated successfully`);
  } catch (error) {
    logger.error('Failed to generate key', { keyType: keyType.value, error });
    toastManager.error(getErrorMessage(error, `Failed to generate ${keyType.value} key`));
  }
};

/* Watchers */
watch(keyType, value => (lastSelectedKeyType = value));

watch(
  () => props.show,
  () => {
    keyType.value = lastSelectedKeyType;
    nickname.value = '';
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
      <form @submit.prevent="handleGenerate">
        <div class="form-group mt-4">
          <label class="form-label">Key Type</label>
          <AppSelect
            v-model:value="keyType"
            :items="keyTypeItems"
            toggle-text="Select key type"
            toggler-icon
            size="small"
            button-class="w-100"
            class="w-100"
            data-testid="select-generate-key-type"
          />
        </div>
        <div class="form-group mt-4">
          <label class="form-label">Enter nickname (optional)</label>
          <AppInput
            v-model="nickname"
            size="small"
            name="nickname"
            :filled="true"
            placeholder="Type nickname"
            data-testid="input-generate-key-nickname"
          />
        </div>

        <hr class="separator my-5" />

        <div class="d-grid">
          <AppButton data-testid="button-generate-key" type="submit" color="primary"
            >Generate</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
