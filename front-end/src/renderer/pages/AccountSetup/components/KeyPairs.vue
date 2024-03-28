<script setup lang="ts">
import { onMounted, onUpdated, ref } from 'vue';

import { Prisma } from '@prisma/client';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';
import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import {
  restorePrivateKey,
  hashRecoveryPhrase,
  // getStoredKeyPairs,
} from '@renderer/services/keyPairService';

import { getWidthOfElementWithText } from '@renderer/utils/dom';

import AppInput from '@renderer/components/ui/AppInput.vue';
import UserPasswordModal from '@renderer/components/UserPasswordModal.vue';
import { getUserState, uploadKey } from '@renderer/services/organization';

/* Stores */
const keyPairsStore = useKeyPairsStore();
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const createTooltips = useCreateTooltips();

/* State */
const nickname = ref('');

const privateKeyRef = ref<HTMLSpanElement | null>(null);
const privateKeyHidden = ref(true);
const starCount = ref(0);

const publicKeys = ref<string[]>([]);
const privateKeys = ref<string[]>([]);

const userPasswordModalShow = ref(false);
const saveAfterModalClose = ref(false);
const userPassword = ref(user.data.password);

/* Misc Functions */
const keyExists = (publicKey: string) =>
  keyPairsStore.keyPairs.some(kp => kp.public_key === publicKey);

const addKeyToRestored = async (index: number) => {
  try {
    const restoredPrivateKey = await restorePrivateKey(
      keyPairsStore.recoveryPhraseWords,
      '',
      index,
      'ED25519',
    );

    privateKeys.value.push(restoredPrivateKey.toStringRaw());
    publicKeys.value.push(restoredPrivateKey.publicKey.toStringRaw());
  } catch {
    toast.error(`Restoring key at index: ${index} failed`, { position: 'bottom-right' });
  }
};

const restoreKeys = async () => {
  if (
    user.data.activeOrganization &&
    user.data.organizationState &&
    user.data.organizationState.secretHashes.length > 0
  ) {
    const secretHash = await hashRecoveryPhrase(keyPairsStore.recoveryPhraseWords);

    for (let i = 0; i < user.data.organizationState.organizationKeys.length; i++) {
      const key = user.data.organizationState.organizationKeys[i];

      if (keyExists(key.publicKey)) continue;

      if (key.mnemonicHash === secretHash && key.index !== undefined) {
        await addKeyToRestored(key.index);
      }
    }
  } else {
    await addKeyToRestored(0);
  }
};

/* Handlers */
const handleSave = async () => {
  if (privateKeys.value.length === 0 || publicKeys.value.length === 0) {
    throw Error('No key pairs to save');
  }

  if (userPassword.value.length === 0) {
    saveAfterModalClose.value = true;
    userPasswordModalShow.value = true;
    return;
  }

  try {
    const secretHash = await hashRecoveryPhrase(keyPairsStore.recoveryPhraseWords);

    for (let i = 0; i < publicKeys.value.length; i++) {
      const publicKey = publicKeys.value[i];
      const privateKey = privateKeys.value[i];

      const keyPair: Prisma.KeyPairUncheckedCreateInput = {
        user_id: user.data.id,
        index: 0,
        public_key: publicKey,
        private_key: privateKey,
        type: 'ED25519',
        organization_id: user.data.activeOrganization?.id || null,
        secret_hash: secretHash,
        nickname: nickname.value || null,
      };

      if (
        user.data.activeOrganization &&
        user.data.organizationState &&
        !user.data.organizationState.organizationKeys.some(k => k.publicKey === publicKey)
      ) {
        await uploadKey(user.data.activeOrganization.id, user.data.id, {
          publicKey,
          index: 0,
          mnemonicHash: secretHash,
        });
        keyPair.nickname = i > 0 ? keyPair.nickname : null;
      }

      await keyPairsStore.storeKeyPair(keyPair, userPassword.value);
      user.data.secretHashes.push(secretHash);
    }

    if (user.data.activeOrganization) {
      const userState = await getUserState(user.data.activeOrganization.id, user.data.id);
      user.data.organizationState = userState;
    }

    toast.success(`Key Pair${publicKeys.value.length > 1 ? 's' : ''} saved successfully`, {
      position: 'bottom-right',
    });

    user.data.password = '';
    router.push({ name: 'settingsKeys' });
  } catch (err: any) {
    let message = `Failed to store key pair${publicKeys.value.length > 1 ? 's' : ''}`;
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'bottom-right' });
  }
};

const handlePasswordEntered = async (password: string) => {
  userPassword.value = password;

  if (saveAfterModalClose.value) {
    await handleSave();
  }
};

/* Hooks */
onMounted(async () => {
  await restoreKeys();

  if (privateKeyRef.value) {
    const privateKeyWidth = getWidthOfElementWithText(privateKeyRef.value, privateKeys.value[0]);
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
      <AppInput v-model="nickname" :filled="true" placeholder="Enter Nickname" />
    </div>
    <div class="form-group w-25 mt-5">
      <label class="form-label">Key Type</label>
      <AppInput model-value="ED25519" readonly />
    </div>
    <div class="form-group mt-5">
      <label class="form-label">ED25519 Private Key</label>
      <p class="text-break text-secondary">
        <span ref="privateKeyRef" id="pr">{{
          !privateKeyHidden ? privateKeys[0] : '*'.repeat(starCount)
        }}</span>
        <span class="cursor-pointer ms-3">
          <i v-if="!privateKeyHidden" class="bi bi-eye-slash" @click="privateKeyHidden = true"></i>
          <i v-else class="bi bi-eye" @click="privateKeyHidden = false"></i>
        </span>
      </p>
    </div>
    <div class="form-group mt-4">
      <label class="form-label">ED25519 Public Key</label>
      <p class="text-break text-secondary">{{ publicKeys[0] }}</p>
    </div>
    <template v-if="publicKeys.length > 1">
      <div class="mt-4">
        <p>{{ publicKeys.length - 1 }} more will be restored</p>
      </div>
    </template>
    <template v-if="user.data.activeOrganization">
      <hr class="my-6" />
      <div class="alert alert-secondary d-flex align-items-start mb-0" role="alert">
        <i class="bi bi-exclamation-triangle text-warning me-3"></i>

        <div>
          <p class="fw-semibold">Sharing Key Pair</p>
          <p>Share this Key Pair from Settings > List of Keys.</p>
        </div>
      </div>
    </template>

    <UserPasswordModal
      v-model:show="userPasswordModalShow"
      heading="Enter personal password"
      subHeading="Credentials will be encrypted with this password"
      @passwordEntered="handlePasswordEntered"
    />
  </div>
</template>
