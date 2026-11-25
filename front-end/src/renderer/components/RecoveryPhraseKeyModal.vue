<script lang="ts">
// Module scope: remembered across openings of the modal for the app session only (not persisted)
let lastSelectedKeyType: 'ED25519' | 'ECDSA' = 'ED25519';
</script>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Prisma } from '@prisma/client';
import { Mnemonic, PrivateKey } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';

import useRecoveryPhraseNickname from '@renderer/composables/useRecoveryPhraseNickname';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { restorePrivateKey } from '@renderer/services/keyPairService';
import { compareDataToHashes } from '@renderer/services/electronUtilsService';

import {
  assertUserLoggedIn,
  getErrorMessage,
  getRecoveryPhraseHashValue,
  isLoggedInOrganization,
  safeAwait,
  safeDuplicateUploadKey,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager';
import { createLogger } from '@renderer/utils/logger';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppSelect from '@renderer/components/ui/AppSelect.vue';
import RecoveryPhraseInput from '@renderer/components/RecoveryPhrase/RecoveryPhraseInput.vue';
import RecoveryPhraseNicknameInput from '@renderer/components/RecoveryPhrase/RecoveryPhraseNicknameInput.vue';

const logger = createLogger('renderer.component.recoveryPhraseKeyModal');

/* Props */
const props = defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Injected */
const toastManager = ToastManager.inject();

/* Stores */
const user = useUserStore();

/* Composables */
const recoveryPhraseNickname = useRecoveryPhraseNickname();
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* Constants */
const keyTypeItems: { label: string; value: 'ED25519' | 'ECDSA' }[] = [
  { label: 'ED25519', value: 'ED25519' },
  { label: 'ECDSA', value: 'ECDSA' },
];

/* State */
const step = ref<1 | 2>(1);
const importRef = ref<InstanceType<typeof RecoveryPhraseInput> | null>(null);
const shouldClearInputs = ref(false);
const isGenerated = ref(false);
// The stored hash of this phrase if we already know it, otherwise its fresh hash
const resolvedHash = ref<string | null>(null);
// The lookup of resolvedHash that is in flight. Saving waits for it, otherwise a phrase that is
// already known could be saved under a new hash.
let knownHashLookup: Promise<void> = Promise.resolve();

const mnemonicHashNickname = ref('');

const keyType = ref<'ED25519' | 'ECDSA'>(lastSelectedKeyType);
const index = ref(0);
const indexEdited = ref(false);
const inputIndexInvalid = ref(false);
const keyNickname = ref('');
const loadingText = ref<string | null>(null);

/* Handlers */
const handleGeneratePhrase = async () => {
  const regenerated = isGenerated.value;

  try {
    const mnemonic = await Mnemonic.generate();
    importRef.value?.setWords(mnemonic.toString().split(' '));
    isGenerated.value = true;
    logger.info('Recovery phrase generated', { regenerated });
  } catch (error) {
    logger.error('Failed to generate recovery phrase', { error });
    toastManager.error(getErrorMessage(error, 'Failed to generate recovery phrase'));
  }
};

const handleClearWords = () => {
  shouldClearInputs.value = true;
  isGenerated.value = false;
  user.setRecoveryPhrase(null);
};

const handleCopyPhrase = async () => {
  if (!user.recoveryPhrase) return;

  try {
    await navigator.clipboard.writeText(user.recoveryPhrase.words.join(', '));
    logger.info('Recovery phrase copied to clipboard');
    toastManager.success('Recovery phrase copied');
  } catch (error) {
    // The error is logged without the phrase
    logger.error('Failed to copy the recovery phrase to the clipboard', { error });
    toastManager.error(getErrorMessage(error, 'Failed to copy the recovery phrase'));
  }
};

const handleNext = () => {
  if (!user.recoveryPhrase) return;
  step.value = 2;
};

const handleIndexInput = (value: string | number) => {
  indexEdited.value = true;
  index.value = Number(value);
};

const handleClose = () => {
  emit('update:show', false);
};

const handleSave = async () => {
  assertUserLoggedIn(user.personal);

  const recoveryPhrase = user.recoveryPhrase;
  if (!recoveryPhrase) {
    logger.error('Cannot save key: recovery phrase not found');
    toastManager.error('Recovery phrase not found');
    return;
  }

  const personalPassword = getPassword(handleSave, {
    subHeading: 'Enter your application password to decrypt your key',
  });
  if (passwordModalOpened(personalPassword)) return;

  try {
    loadingText.value = 'Restoring key pair...';

    await knownHashLookup;

    const privateKey = await restorePrivateKey(
      recoveryPhrase.words,
      '',
      Number(index.value),
      keyType.value,
    );

    if (keyExists(privateKey)) {
      logger.warn('Key already exists at this index', {
        keyType: keyType.value,
        index: Number(index.value),
      });
      inputIndexInvalid.value = true;
      return;
    }
    inputIndexInvalid.value = false;

    const mnemonicHash = resolvedHash.value ?? recoveryPhrase.hash;

    loadingText.value = 'Saving key pair...';

    const publicKey = privateKey.publicKey.toStringRaw();
    const keyPair: Prisma.KeyPairUncheckedCreateInput = {
      user_id: user.personal.id,
      index: Number(index.value),
      private_key: privateKey.toStringRaw(),
      public_key: publicKey,
      type: keyType.value,
      organization_id: null,
      organization_user_id: null,
      secret_hash: mnemonicHash,
      nickname: keyNickname.value || null,
    };

    if (isLoggedInOrganization(user.selectedOrganization)) {
      keyPair.organization_id = user.selectedOrganization.id;
      keyPair.organization_user_id = user.selectedOrganization.userId;

      await safeDuplicateUploadKey(user.selectedOrganization, {
        publicKey,
        index: keyPair.index,
        mnemonicHash,
      });
    }

    await user.storeKey(keyPair, mnemonicHash, personalPassword, false);

    await safeAwait(recoveryPhraseNickname.set(mnemonicHash, mnemonicHashNickname.value));
    user.recoveryPhrase = null;
    await user.refetchUserState();

    logger.info('Key saved from recovery phrase', {
      keyType: keyType.value,
      index: Number(index.value),
      publicKey,
      phraseWasGenerated: isGenerated.value,
      uploadedToOrganization: isLoggedInOrganization(user.selectedOrganization),
    });

    handleClose();
    toastManager.success('Key pair saved');
  } catch (error) {
    logger.error('Failed to save key from recovery phrase', {
      keyType: keyType.value,
      index: Number(index.value),
      error,
    });
    toastManager.error(getErrorMessage(error, 'Failed to store private key'));
  } finally {
    loadingText.value = null;
  }
};

/* Functions */
const keyExists = (privateKey: PrivateKey) =>
  user.keyPairs.some(kp => kp.public_key === privateKey.publicKey.toStringRaw());

const findEmptyIndex = async () => {
  const words = user.recoveryPhrase?.words;
  if (!words) return;

  let candidate = 0;
  while (keyExists(await restorePrivateKey(words, '', candidate, keyType.value))) {
    candidate++;
  }

  if (!indexEdited.value) {
    index.value = candidate;
  }
};

// Looks for this phrase among the hashes we already know (stored recovery phrases and keys),
// so that its existing nickname can be shown and the existing hash reused
const resolveKnownHash = async () => {
  const recoveryPhrase = user.recoveryPhrase;
  if (!recoveryPhrase) {
    resolvedHash.value = null;
    return;
  }

  const hashes = new Set<string>();
  user.mnemonics.forEach(m => hashes.add(m.mnemonicHash));
  user.keyPairs.forEach(k => k.secret_hash && hashes.add(k.secret_hash));
  if (isLoggedInOrganization(user.selectedOrganization)) {
    user.selectedOrganization.userKeys.forEach(k => k.mnemonicHash && hashes.add(k.mnemonicHash));
  }

  const knownHash = await compareDataToHashes(getRecoveryPhraseHashValue(recoveryPhrase.words), [
    ...hashes,
  ]);

  // Ignore the result if the phrase changed while we were comparing
  if (user.recoveryPhrase?.hash === recoveryPhrase.hash) {
    resolvedHash.value = knownHash ?? recoveryPhrase.hash;
  }
};

/* Watchers */
watch(
  () => user.recoveryPhrase?.hash,
  () => {
    indexEdited.value = false;
    resolvedHash.value = null;
    knownHashLookup = resolveKnownHash().catch(error =>
      logger.error('Failed to look up the recovery phrase nickname', { error }),
    );
    findEmptyIndex().catch(error => logger.error('Failed to find an unused key index', { error }));
  },
);

watch(keyType, value => {
  lastSelectedKeyType = value;
  findEmptyIndex().catch(error => logger.error('Failed to find an unused key index', { error }));
});

watch([index, keyType], () => (inputIndexInvalid.value = false));

watch(
  () => props.show,
  show => {
    step.value = 1;
    isGenerated.value = false;
    resolvedHash.value = null;
    mnemonicHashNickname.value = '';
    keyType.value = lastSelectedKeyType;
    index.value = 0;
    indexEdited.value = false;
    inputIndexInvalid.value = false;
    keyNickname.value = '';
    loadingText.value = null;
    // Never leave a recovery phrase in memory while the modal is closed
    user.recoveryPhrase = null;
    if (!show) shouldClearInputs.value = false;
  },
);
</script>

<template>
  <AppModal
    v-if="show"
    :show="show"
    @update:show="handleClose"
    class="large-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <i class="bi bi-x-lg cursor-pointer" @click="handleClose"></i>
      <div class="text-center mt-4">
        <i class="bi bi-key large-icon" style="line-height: 16px"></i>
      </div>

      <!-- Step 1: recovery phrase (kept mounted so going back does not lose its state) -->
      <form v-show="step === 1" @submit.prevent="handleNext">
        <h3 class="text-center text-title text-bold mt-3">Recovery Phrase</h3>
        <p class="text-center mt-3">Enter an existing recovery phrase, or generate a new one.</p>

        <RecoveryPhraseInput
          ref="importRef"
          :should-clear="shouldClearInputs"
          @reset-cleared="shouldClearInputs = $event"
          class="mt-4"
        />

        <p
          v-if="isGenerated"
          class="text-small text-warning mt-4 mb-0"
          data-testid="label-save-recovery-phrase-warning"
        >
          Save this recovery phrase somewhere safe. It is the only way to recover the keys created
          from it.
        </p>

        <div class="form-group mt-4">
          <label class="form-label">Recovery Phrase Nickname (optional)</label>
          <RecoveryPhraseNicknameInput
            v-model="mnemonicHashNickname"
            :mnemonic-hash="resolvedHash"
            size="small"
            :filled="true"
            data-testid="input-recovery-phrase-nickname"
          />
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4 overflow-hidden">
          <AppButton color="borderless" type="button" class="min-w-unset" @click="handleClearWords"
            >Clear</AppButton
          >
          <div class="flex-between-centered gap-4">
            <AppButton
              color="secondary"
              type="button"
              data-testid="button-copy-phrase"
              :disabled="!user.recoveryPhrase"
              @click="handleCopyPhrase"
              ><i class="bi bi-copy"></i> <span>Copy</span></AppButton
            >
            <AppButton
              color="secondary"
              type="button"
              data-testid="button-generate-phrase"
              @click="handleGeneratePhrase"
              >{{ isGenerated ? 'Regenerate' : 'Generate' }}</AppButton
            >
            <AppButton
              color="primary"
              type="submit"
              data-testid="button-continue-phrase"
              :disabled="!user.recoveryPhrase"
              >Next</AppButton
            >
          </div>
        </div>
      </form>

      <!-- Step 2: key details -->
      <form v-if="step === 2" @submit.prevent="handleSave">
        <h3 class="text-center text-title text-bold mt-3">Key Details</h3>
        <p class="text-center mt-3">Choose which key to create from the recovery phrase.</p>

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
            data-testid="select-recovery-key-type"
          />
        </div>
        <div class="form-group mt-4">
          <label class="form-label">Key Index</label>
          <AppInput
            :model-value="index"
            @update:model-value="handleIndexInput"
            size="small"
            :filled="true"
            data-testid="input-index"
            type="number"
            :class="{ 'is-invalid': inputIndexInvalid }"
            placeholder="Enter key index"
          />
          <div v-if="inputIndexInvalid" class="invalid-feedback">
            Key at index {{ index }} is already restored.
          </div>
        </div>
        <div class="form-group mt-4">
          <label class="form-label">Key Nickname (optional)</label>
          <AppInput
            v-model="keyNickname"
            size="small"
            :filled="true"
            data-testid="input-nickname"
            placeholder="Enter nickname"
          />
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4 overflow-hidden">
          <AppButton
            color="secondary"
            type="button"
            data-testid="button-recovery-back"
            :disabled="Boolean(loadingText)"
            @click="step = 1"
            >Back</AppButton
          >
          <AppButton
            color="primary"
            type="submit"
            data-testid="button-save-recovery-key"
            :disabled="Number(index) < 0"
            :loading="Boolean(loadingText)"
            :loading-text="loadingText || ''"
            >Save</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
