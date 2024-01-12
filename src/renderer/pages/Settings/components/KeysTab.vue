<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { PublicKey } from '@hashgraph/sdk';

import useUserStore from '../../../stores/storeUser';
import useKeyPairsStore from '../../../stores/storeKeyPairs';

import { useToast } from 'vue-toast-notification';

import {
  decryptPrivateKey,
  generateECDSAKeyPairFromString,
} from '../../../services/keyPairService';

import AppButton from '../../../components/ui/AppButton.vue';
import AppModal from '../../../components/ui/AppModal.vue';

/* Stores */
const keyPairsStore = useKeyPairsStore();
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const isDecryptedModalShown = ref(false);
const isImportECDSAKeyModalShown = ref(false);
const decryptedKey = ref<string | null>(null);
const publicKeysPrivateKeyToDecrypt = ref('');
const userPassword = ref('');
const ecdsaKey = reactive<{ privateKey: string; nickname?: string }>({
  privateKey: '',
});

/* Handlers */
const handleShowDecryptModal = (publicKey: string) => {
  publicKeysPrivateKeyToDecrypt.value = publicKey;
  isDecryptedModalShown.value = true;
};

const handleDecrypt = async e => {
  e.preventDefault();

  try {
    if (!user.data.isLoggedIn) {
      throw Error('No user selected');
    }

    decryptedKey.value = await decryptPrivateKey(
      user.data.email,
      userPassword.value,
      publicKeysPrivateKeyToDecrypt.value,
    );
  } catch (err: any) {
    toast.error('Failed to decrypt private key', { position: 'top-right' });
  }
};

const handleImportExternalKey = async e => {
  e.preventDefault();

  try {
    await keyPairsStore.storeKeyPair(
      userPassword.value,
      generateECDSAKeyPairFromString(ecdsaKey.privateKey || '', ecdsaKey.nickname || ''),
    );

    isImportECDSAKeyModalShown.value = false;

    userPassword.value = '';
    ecdsaKey.nickname = '';
    ecdsaKey.privateKey = '';
  } catch (err: any) {
    toast.error(err.message || 'Failed to import ECDSA private key', { position: 'top-right' });
  }
};

/* Hooks */
onMounted(() => {
  keyPairsStore.refetch();
});

/* Watchers */
watch(isDecryptedModalShown, newVal => {
  if (!newVal) {
    decryptedKey.value = null;
    publicKeysPrivateKeyToDecrypt.value = '';
    userPassword.value = '';
  }
});
</script>
<template>
  <div>
    <div class="d-flex gap-4">
      <RouterLink class="btn btn-primary mb-4" :to="{ name: 'restoreKey' }">Restore key</RouterLink>
      <AppButton class="btn btn-primary mb-4" @click="isImportECDSAKeyModalShown = true"
        >Import ECDSA Key</AppButton
      >
    </div>
    <div
      v-for="keyPair in keyPairsStore.keyPairs"
      :key="keyPair.publicKey"
      class="rounded bg-dark-blue-700 p-4 mt-4"
    >
      <div class="d-flex justify-content-between align-items-center">
        <div class="mb-3 d-flex">
          <p v-if="keyPair.index >= 0" class="me-3 text-secondary text-bold text-main">
            Index: {{ keyPair.index }}
          </p>
          <p v-else-if="!keyPair.nickname" class="me-3 text-secondary text-bold text-main">
            ECDSA Imported Key Pair
          </p>
          <p v-if="keyPair.nickname" class="text-secondary text-bold text-main">
            Nickname: {{ keyPair.nickname }}
          </p>
        </div>
        <AppButton size="small" color="primary" @click="handleShowDecryptModal(keyPair.publicKey)"
          >Decrypt Private Key</AppButton
        >
      </div>
      <div class="form-group">
        <label class="form-label">Encrypted Private key</label>
        <input type="text" readonly class="form-control py-3" :value="keyPair.privateKey" />
      </div>
      <div class="form-group mt-3">
        <label class="form-label"
          >{{
            PublicKey.fromString(keyPair.publicKey)._key._type === 'secp256k1' ? 'ECDSA' : 'ED25519'
          }}
          Public key</label
        >
        <input type="text" readonly class="form-control py-3" :value="keyPair.publicKey" />
      </div>
      <div v-show="keyPair.accountId" class="form-group mt-3">
        <label class="form-label">Account ID</label>
        <input type="text" readonly class="form-control py-3" :value="keyPair.accountId" />
      </div>
    </div>
    <AppModal v-model:show="isDecryptedModalShown" class="common-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isDecryptedModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <Transition name="fade" mode="out-in">
            <i
              v-if="!decryptedKey"
              class="bi bi-lock extra-large-icon cursor-pointer"
              style="line-height: 16px"
              @click="isDecryptedModalShown = false"
            ></i>
            <i
              v-else
              class="bi bi-unlock extra-large-icon cursor-pointer"
              style="line-height: 16px"
              @click="isDecryptedModalShown = false"
            ></i>
          </Transition>
        </div>
        <form @submit="handleDecrypt">
          <h3 class="mt-5 text-main text-center text-bold">Enter your password</h3>
          <input
            v-model="userPassword"
            type="password"
            class="mt-5 form-control rounded-4"
            placeholder="Type your password"
          />
          <div class="mt-4 form-group">
            <label class="form-label">Decrypted Private key</label>
            <input v-model="decryptedKey" type="text" class="form-control rounded-4" readonly />
          </div>
          <AppButton
            type="submit"
            color="primary"
            size="large"
            class="mt-5 w-100 rounded-4"
            :disabled="userPassword.length === 0"
            >Decrypt</AppButton
          >
        </form>
      </div>
    </AppModal>
    <AppModal v-model:show="isImportECDSAKeyModalShown" class="common-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isDecryptedModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-key extra-large-icon" style="line-height: 16px"></i>
        </div>
        <form @submit="handleImportExternalKey">
          <div class="mt-4 form-group">
            <label class="form-label">Enter your password</label>
            <input
              v-model="userPassword"
              type="password"
              class="form-control rounded-4"
              placeholder="Type your password"
            />
          </div>
          <div class="mt-4 form-group">
            <label class="form-label">Enter nickname (optional)</label>
            <input
              v-model="ecdsaKey.nickname"
              class="form-control rounded-4"
              name="nickname"
              placeholder="Type nickname"
            />
          </div>
          <div class="mt-4 form-group">
            <label class="form-label">Enter ECDSA Private key</label>
            <input
              v-model="ecdsaKey.privateKey"
              class="form-control rounded-4"
              name="private-key"
              placeholder="Type ECDSA Private key"
            />
          </div>
          <AppButton type="submit" color="primary" size="large" class="mt-5 w-100 rounded-4"
            >Import</AppButton
          >
        </form>
      </div>
    </AppModal>
  </div>
</template>
