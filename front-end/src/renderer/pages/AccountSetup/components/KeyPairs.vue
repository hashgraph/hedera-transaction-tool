<script setup lang="ts">
import type { KeyPair } from '@prisma/client';
import type { USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import { inject, onBeforeMount, onUpdated, ref } from 'vue';

import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { restorePrivateKey } from '@renderer/services/keyPairService';
import { uploadKey } from '@renderer/services/organization';

import { USER_PASSWORD_MODAL_KEY } from '@renderer/providers';

import { getWidthOfElementWithText, isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import { compareHash } from '@renderer/services/electronUtilsService';

/* Props */
const props = defineProps<{
  selectedPersonalKeyPair: KeyPair | null;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const createTooltips = useCreateTooltips();

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

/* State */
const nickname = ref(props.selectedPersonalKeyPair?.nickname || '');

const privateKeyRef = ref<HTMLSpanElement | null>(null);
const privateKeyHidden = ref(true);
const starCount = ref(0);

const keys = ref<{ publicKey: string; privateKey: string; index: number; encrypted: boolean }[]>(
  [],
);

/* Misc Functions */
const keyExists = (publicKey: string) => user.keyPairs.some(kp => kp.public_key === publicKey);

const addKeyToRestored = async (index: number) => {
  if (!user.recoveryPhrase && !props.selectedPersonalKeyPair) {
    throw new Error('Recovery phrase is not set or personal key pair is not selected');
  }

  try {
    if (user.recoveryPhrase) {
      const restoredPrivateKey = await restorePrivateKey(
        user.recoveryPhrase.words,
        '',
        index,
        'ED25519',
      );
      keys.value.push({
        publicKey: restoredPrivateKey.publicKey.toStringRaw(),
        privateKey: restoredPrivateKey.toStringRaw(),
        index,
        encrypted: false,
      });
    } else if (props.selectedPersonalKeyPair) {
      keys.value.push({
        publicKey: props.selectedPersonalKeyPair.public_key,
        privateKey: props.selectedPersonalKeyPair.private_key,
        index,
        encrypted: true,
      });
    }
  } catch {
    toast.error(`Restoring key at index: ${index} failed`);
  }
};

const restoreKeys = async () => {
  if (isLoggedInOrganization(user.selectedOrganization)) {
    if (!user.recoveryPhrase) {
      throw new Error('Recovery phrase is not set');
    }

    for (let i = 0; i < user.selectedOrganization.userKeys.length; i++) {
      const key = user.selectedOrganization.userKeys[i];

      if (
        !keyExists(key.publicKey) &&
        key.mnemonicHash &&
        key.index !== undefined &&
        key.index !== null
      ) {
        const isFromRecoveryPhrase = await compareHash(
          [...user.recoveryPhrase.words].toString(),
          key.mnemonicHash,
        );
        if (isFromRecoveryPhrase) {
          await addKeyToRestored(key.index);
        }
      }
    }

    if (keys.value.length === 0) {
      await addKeyToRestored(0);
    }
  } else {
    if (props.selectedPersonalKeyPair) {
      await addKeyToRestored(props.selectedPersonalKeyPair.index);
    } else {
      await addKeyToRestored(0);
    }
  }
};

/* Handlers */
const handleSave = async () => {
  if (keys.value.length === 0) throw Error('No key pairs to save');

  if (!isUserLoggedIn(user.personal)) throw Error('User is not logged in');
  const personalPassword = user.getPassword();

  if (!personalPassword && !user.personal.useKeychain) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    userPasswordModalRef.value?.open(
      'Enter personal password',
      'Private key/s will be encrypted with this password',
      handleSave,
    );
    return;
  }

  if (
    (!user.recoveryPhrase || user.recoveryPhrase.words.length === 0) &&
    !props.selectedPersonalKeyPair
  ) {
    throw new Error('Recovery phrase is not set or personal key pair is not selected');
  }

  try {
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
        secret_hash: user.recoveryPhrase?.hash || props.selectedPersonalKeyPair?.secret_hash,
        nickname: i === 0 && nickname.value ? nickname.value : null,
      };

      if (isLoggedInOrganization(user.selectedOrganization)) {
        keyPair.organization_id = user.selectedOrganization.id;
        keyPair.organization_user_id = user.selectedOrganization.userId;

        if (!user.selectedOrganization.userKeys.some(k => k.publicKey === key.publicKey)) {
          await uploadKey(user.selectedOrganization.serverUrl, user.selectedOrganization.userId, {
            publicKey: key.publicKey,
            index: key.index,
            mnemonicHash:
              user.recoveryPhrase?.hash || props.selectedPersonalKeyPair?.secret_hash || '',
          });
        }
      }

      const recoveryWords = user.recoveryPhrase?.words || [];

      await user.storeKey(
        keyPair,
        props.selectedPersonalKeyPair ? props.selectedPersonalKeyPair.secret_hash : recoveryWords,
        personalPassword,
        Boolean(props.selectedPersonalKeyPair),
      );
      user.secretHashes.push(
        user.recoveryPhrase?.hash || props.selectedPersonalKeyPair?.secret_hash || '',
      );
    }

    toast.success(`Key Pair${keys.value.length > 1 ? 's' : ''} saved successfully`);
    router.push({ name: 'settingsKeys' });
  } catch (err) {
    let message = `Failed to store key pair${keys.value.length > 1 ? 's' : ''}`;
    if (err instanceof Error && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message);
  }

  await user.refetchUserState();
};

/* Hooks */
onBeforeMount(async () => {
  await restoreKeys();

  if (privateKeyRef.value) {
    const privateKeyWidth = getWidthOfElementWithText(
      privateKeyRef.value,
      keys.value[0].privateKey,
    );
    const starWidth = getWidthOfElementWithText(privateKeyRef.value, '*');

    starCount.value = Math.round(privateKeyWidth / starWidth);
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
