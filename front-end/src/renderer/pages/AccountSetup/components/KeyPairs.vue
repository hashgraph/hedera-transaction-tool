<script setup lang="ts">
import { onBeforeMount, onUpdated, ref } from 'vue';

import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { restorePrivateKey } from '@renderer/services/keyPairService';
import { uploadKey } from '@renderer/services/organization';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils/userStoreHelpers';
import { getWidthOfElementWithText } from '@renderer/utils/dom';

import AppInput from '@renderer/components/ui/AppInput.vue';
import UserPasswordModal from '@renderer/components/UserPasswordModal.vue';

/* Stores */
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

const keys = ref<{ publicKey: string; privateKey: string; index: number }[]>([]);

const userPasswordModalShow = ref(false);
const saveAfterModalClose = ref(false);
const userPassword = ref(isUserLoggedIn(user.personal) ? user.personal.password : null);

/* Misc Functions */
const keyExists = (publicKey: string) => user.keyPairs.some(kp => kp.public_key === publicKey);

const addKeyToRestored = async (index: number) => {
  if (!user.recoveryPhrase) {
    throw new Error('Recovery phrase is not set');
  }

  try {
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
    });
  } catch {
    toast.error(`Restoring key at index: ${index} failed`, { position: 'bottom-right' });
  }
};

const restoreKeys = async () => {
  if (
    isLoggedInOrganization(user.selectedOrganization) &&
    user.selectedOrganization.secretHashes.length > 0
  ) {
    if (!user.recoveryPhrase) {
      throw new Error('Recovery phrase is not set');
    }

    for (let i = 0; i < user.selectedOrganization.userKeys.length; i++) {
      const key = user.selectedOrganization.userKeys[i];

      if (keyExists(key.publicKey)) continue;

      if (key.mnemonicHash === user.recoveryPhrase.hash && key.index !== undefined) {
        await addKeyToRestored(key.index);
      }
    }
  } else {
    await addKeyToRestored(0);
  }
};

/* Handlers */
const handleSave = async () => {
  if (keys.value.length === 0) {
    throw Error('No key pairs to save');
  }

  if (!isUserLoggedIn(user.personal)) {
    throw Error('User is logged in');
  }

  if (!user.recoveryPhrase) {
    throw Error('Recovery phrase is not set');
  }

  if (!userPassword.value || userPassword.value === '') {
    saveAfterModalClose.value = true;
    userPasswordModalShow.value = true;
    return;
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
        organization_id: user.selectedOrganization?.id || null,
        secret_hash: user.recoveryPhrase.hash,
        nickname: i === 0 && nickname.value ? nickname.value : null,
      };

      if (
        isLoggedInOrganization(user.selectedOrganization) &&
        !user.selectedOrganization.userKeys.some(k => k.publicKey === key.publicKey)
      ) {
        await uploadKey(user.selectedOrganization.serverUrl, user.selectedOrganization.userId, {
          publicKey: key.publicKey,
          index: key.index,
          mnemonicHash: user.recoveryPhrase.hash,
        });
      }

      await user.storeKey(keyPair, userPassword.value);
      user.secretHashes.push(user.recoveryPhrase.hash);
    }

    toast.success(`Key Pair${keys.value.length > 1 ? 's' : ''} saved successfully`, {
      position: 'bottom-right',
    });
    user.personal.password = '';
    router.push({ name: 'settingsKeys' });
  } catch (err: any) {
    let message = `Failed to store key pair${keys.value.length > 1 ? 's' : ''}`;
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'bottom-right' });
  }

  await user.refetchUserState();
};

const handlePasswordEntered = async (password: string) => {
  userPassword.value = password;

  if (saveAfterModalClose.value) {
    await handleSave();
  }
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
        data-test-id="input-nickname"
        v-model="nickname"
        :filled="true"
        placeholder="Enter Nickname"
      />
    </div>
    <div class="form-group w-25 mt-5">
      <label class="form-label">Key Type</label>
      <AppInput data-test-id="input-key-type" model-value="ED25519" readonly />
    </div>
    <template v-if="keys.length > 0">
      <div class="form-group mt-5">
        <label class="form-label">ED25519 Private Key</label>
        <p class="text-break text-secondary">
          <span ref="privateKeyRef" id="pr">{{
            !privateKeyHidden ? keys[0].privateKey : '*'.repeat(starCount)
          }}</span>
          <span class="cursor-pointer ms-3">
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
        <label class="form-label">ED25519 Public Key</label>
        <p class="text-break text-secondary">{{ keys[0].publicKey }}</p>
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

    <UserPasswordModal
      v-model:show="userPasswordModalShow"
      heading="Enter personal password"
      subHeading="Credentials will be encrypted with this password"
      @passwordEntered="handlePasswordEntered"
    />
  </div>
</template>
