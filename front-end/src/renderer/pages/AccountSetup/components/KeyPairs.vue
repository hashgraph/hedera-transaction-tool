<script setup lang="ts">
import type { KeyPair } from '@prisma/client';
import type { ConnectedOrganization } from '@renderer/types';

import { onBeforeMount, onUpdated, ref } from 'vue';

import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { restorePrivateKey } from '@renderer/services/keyPairService';

import {
  assertUserLoggedIn,
  getErrorMessage,
  getWidthOfElementWithText,
  isLoggedInOrganization,
  restoreOrganizationKeys,
  safeAwait,
  safeDuplicateUploadKey,
  throwError,
} from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  selectedPersonalKeyPair: KeyPair | null;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'restore:start'): void;
  (event: 'restore:end'): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const createTooltips = useCreateTooltips();
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const nickname = ref(props.selectedPersonalKeyPair?.nickname || '');
const privateKeyRef = ref<HTMLSpanElement | null>(null);
const privateKeyHidden = ref(true);
const starCount = ref(0);
const keys = ref<
  {
    publicKey: string;
    privateKey: string;
    index: number;
    mnemonicHash: string;
    encrypted: boolean;
  }[]
>([]);

/* Misc Functions */
const addKeyToRestored = async (index: number, mnemonicHash: string, veirificationKey?: string) => {
  const key = {
    publicKey: '',
    privateKey: '',
    index,
    mnemonicHash,
    encrypted: false,
  };
  try {
    if (user.recoveryPhrase) {
      const restoredPrivateKey = await restorePrivateKey(
        user.recoveryPhrase.words,
        '',
        index,
        'ED25519',
      );
      key.publicKey = restoredPrivateKey.publicKey.toStringRaw();
      key.privateKey = restoredPrivateKey.toStringRaw();
    } else if (props.selectedPersonalKeyPair) {
      key.publicKey = props.selectedPersonalKeyPair.public_key;
      key.privateKey = props.selectedPersonalKeyPair.private_key;
      key.encrypted = true;
    }

    if (key.publicKey !== '') {
      if (veirificationKey && veirificationKey !== key.publicKey) {
        throw new Error(
          'Verification key does not match the restored key, ensure that the key type is ED25519',
        );
      }

      keys.value.push(key);
    }
  } catch (e) {
    toast.error(getErrorMessage(e, `Restoring key at index: ${index} failed`));
  }
};

const restoreDefaultKey = async () => {
  if (!user.recoveryPhrase) {
    throw new Error('Recovery phrase is not set');
  }
  await addKeyToRestored(0, user.recoveryPhrase.hash);
};

const restoreForExistingKey = async (key: KeyPair) => {
  if (!key.secret_hash) {
    throw new Error('(BUG) Recovery phrase is not set on the existing key pair');
  }
  await addKeyToRestored(key.index, key.secret_hash, key.public_key);
};

const restoreForOrganization = async (organization: ConnectedOrganization) => {
  const restoredKeys = await restoreOrganizationKeys(
    organization,
    user.recoveryPhrase,
    user.personal,
    user.keyPairs,
    false,
  );

  for (const key of restoredKeys.keys) {
    keys.value.push(key);
  }

  for (const error of restoredKeys.failedRestoreMessages) {
    toast.error(error);
  }

  if (restoredKeys.keys.length === 0) {
    await restoreDefaultKey();
  }
};

const restoreKeys = async () => {
  if (props.selectedPersonalKeyPair) {
    await restoreForExistingKey(props.selectedPersonalKeyPair);
  } else if (isLoggedInOrganization(user.selectedOrganization)) {
    await restoreForOrganization(user.selectedOrganization);
  } else {
    await restoreDefaultKey();
  }
};

const setPrivateKeyStarCount = () => {
  if (privateKeyRef.value) {
    const privateKeyWidth = getWidthOfElementWithText(
      privateKeyRef.value,
      keys.value[0].privateKey,
    );
    const starWidth = getWidthOfElementWithText(privateKeyRef.value, '*');

    starCount.value = Math.round(privateKeyWidth / starWidth);
  }
};

/* Handlers */
const handleSave = async () => {
  if (keys.value.length === 0) throw Error('No key pairs to save');

  assertUserLoggedIn(user.personal);
  const personalPassword = getPassword(handleSave, {
    subHeading: 'Private key/s will be encrypted with this password',
  });
  if (passwordModalOpened(personalPassword)) return;

  let storedCount = 0;
  for (let i = 0; i < keys.value.length; i++) {
    const key = keys.value[i];
    const keyPair: Prisma.KeyPairUncheckedCreateInput = {
      user_id: user.personal.id,
      index: key.index,
      public_key: key.publicKey,
      private_key: key.privateKey,
      type: 'ED25519',
      organization_id: null,
      organization_user_id: null,
      secret_hash: key.mnemonicHash,
      nickname: i === 0 && nickname.value ? nickname.value : null,
    };

    try {
      if (isLoggedInOrganization(user.selectedOrganization)) {
        keyPair.organization_id = user.selectedOrganization.id;
        keyPair.organization_user_id = user.selectedOrganization.userId;

        await safeDuplicateUploadKey(user.selectedOrganization, {
          publicKey: key.publicKey,
          index: key.index,
          mnemonicHash: key.mnemonicHash,
        });
      }

      await user.storeKey(
        keyPair,
        key.mnemonicHash,
        personalPassword,
        Boolean(props.selectedPersonalKeyPair),
      );
      if (!user.secretHashes.includes(key.mnemonicHash)) {
        user.secretHashes.push(key.mnemonicHash);
      }
      storedCount++;
    } catch (e) {
      toast.error(getErrorMessage(e, `Failed to store key pair: ${key.publicKey}`));
    }
  }
  router.push({ name: 'settingsKeys' });

  if (storedCount > 0) {
    toast.success(`Key Pair${storedCount > 1 ? 's' : ''} saved successfully`);
  }
  router.push({ name: 'settingsKeys' });

  await user.refetchUserState();
};

/* Hooks */
onBeforeMount(async () => {
  emit('restore:start');
  const { error } = await safeAwait(restoreKeys());
  emit('restore:end');

  setPrivateKeyStarCount();

  if (error) {
    throwError(getErrorMessage(error, 'Failed to restore keys'));
  }
});

onUpdated(() => {
  createTooltips();
});

/* Expose */
defineExpose({
  handleSave,
});
</script>
<template>
  <div class="fill-remaining mt-5">
    <div class="form-group mt-5">
      <label class="form-label">Nickname <span class="fw-normal">- Optional</span></label>
      <AppInput
        data-testid="input-nickname"
        v-model="nickname"
        :filled="true"
        placeholder="Enter Nickname"
      />
    </div>
    <div class="form-group w-25 mt-5">
      <label data-testid="label-key-type" class="form-label">Key Type</label>
      <AppInput data-testid="input-key-type" model-value="ED25519" readonly />
    </div>
    <template v-if="keys.length > 0">
      <div class="form-group mt-5">
        <label data-testid="label-private-key" class="form-label"
          >ED25519 Private Key
          <span v-if="selectedPersonalKeyPair" class="text-pink">Encrypted</span></label
        >
        <p class="text-break text-secondary">
          <span ref="privateKeyRef" data-testid="span-shown-private-key" id="pr">{{
            !privateKeyHidden ? keys[0].privateKey : '*'.repeat(starCount)
          }}</span>
          <span data-testid="button-show-private-key" class="cursor-pointer ms-3">
            <i
              v-if="!privateKeyHidden"
              class="bi bi-eye-slash"
              @click="privateKeyHidden = true"
            ></i>
            <i v-else class="bi bi-eye" @click="privateKeyHidden = false"></i>
          </span>
        </p>
      </div>
      <div class="form-group mt-4">
        <label data-testid="label-public-key" class="form-label">ED25519 Public Key</label>
        <p data-testid="p-show-public-key" class="text-break text-secondary">
          {{ keys[0].publicKey }}
        </p>
      </div>
    </template>
    <template v-if="keys.length > 1">
      <div class="mt-4">
        <p>{{ keys.length - 1 }} more will be restored</p>
      </div>
    </template>
    <template v-if="user.selectedOrganization">
      <hr class="my-6" />
      <div class="alert alert-secondary d-flex align-items-start mb-0" role="alert">
        <i class="bi bi-exclamation-triangle text-warning me-3"></i>

        <div>
          <p class="fw-semibold">Sharing Key Pair</p>
          <p>Share this Key Pair from Settings > List of Keys.</p>
        </div>
      </div>
    </template>
  </div>
</template>
