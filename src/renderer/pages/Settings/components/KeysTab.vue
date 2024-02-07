<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { PublicKey } from '@hashgraph/sdk';
import { KeyPair } from '@prisma/client';

import useUserStore from '../../../stores/storeUser';
import useKeyPairsStore from '../../../stores/storeKeyPairs';

import { useToast } from 'vue-toast-notification';

import {
  decryptPrivateKey,
  generateExternalKeyPairFromString,
} from '../../../services/keyPairService';
import { comparePasswords } from '../../../services/userService';

import AppButton from '../../../components/ui/AppButton.vue';
import AppModal from '../../../components/ui/AppModal.vue';
import AppInput from '../../../components/ui/AppInput.vue';

/* Stores */
const keyPairsStore = useKeyPairsStore();
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const isDecryptedModalShown = ref(false);
const isImportECDSAKeyModalShown = ref(false);
const isImportED25519KeyModalShown = ref(false);
const decryptedKey = ref('');
const publicKeysPrivateKeyToDecrypt = ref('');
const userPassword = ref('');
const ecdsaKey = reactive<{ privateKey: string; nickname?: string }>({
  privateKey: '',
});
const ed25519Key = reactive<{ privateKey: string; nickname?: string }>({
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
      user.data.id,
      userPassword.value,
      publicKeysPrivateKeyToDecrypt.value,
    );
  } catch (err: any) {
    toast.error('Failed to decrypt private key', { position: 'bottom-right' });
  }
};

const handleImportExternalKey = async e => {
  e.preventDefault();

  try {
    const keyPair: KeyPair = {
      id: '',
      user_id: user.data.id,
      ...generateExternalKeyPairFromString(
        ecdsaKey.privateKey || '',
        'ECDSA',
        ecdsaKey.nickname || '',
      ),
      organization_id: null,
      type: 'ECDSA',
      secret_hash: null,
    };

    if (keyPairsStore.keyPairs.find(kp => kp.public_key === keyPair.public_key)) {
      throw new Error('Key pair already exists');
    }

    if (!(await comparePasswords(user.data.id, userPassword.value))) {
      throw new Error('Incorrect password');
    }

    await keyPairsStore.storeKeyPair(keyPair, userPassword.value);

    isImportECDSAKeyModalShown.value = false;

    toast.success('ECDSA private key imported successfully', { position: 'bottom-right' });
  } catch (err: any) {
    toast.error(err.message || 'Failed to import ECDSA private key', { position: 'bottom-right' });
  }
};

const handleImportExternalED25519Key = async e => {
  e.preventDefault();

  try {
    const keyPair: KeyPair = {
      id: '',
      user_id: user.data.id,
      ...generateExternalKeyPairFromString(
        ed25519Key.privateKey || '',
        'ED25519',
        ed25519Key.nickname || '',
      ),
      organization_id: null,
      type: 'ED25519',
      secret_hash: null,
    };

    if (keyPairsStore.keyPairs.find(kp => kp.public_key === keyPair.public_key)) {
      throw new Error('Key pair already exists');
    }

    if (!(await comparePasswords(user.data.id, userPassword.value))) {
      throw new Error('Incorrect password');
    }

    await keyPairsStore.storeKeyPair(keyPair, userPassword.value);

    isImportED25519KeyModalShown.value = false;

    toast.success('ED25519 private key imported successfully', { position: 'bottom-right' });
  } catch (err: any) {
    toast.error(err.message || 'Failed to import ED25519 private key', {
      position: 'bottom-right',
    });
  }
};
/* Hooks */
onMounted(() => {
  keyPairsStore.refetch();
});

/* Watchers */
watch(isDecryptedModalShown, newVal => {
  if (!newVal) {
    decryptedKey.value = '';
    publicKeysPrivateKeyToDecrypt.value = '';
    userPassword.value = '';
  }
});
watch(isImportECDSAKeyModalShown, () => {
  userPassword.value = '';
  ecdsaKey.nickname = '';
  ecdsaKey.privateKey = '';
});
</script>
<template>
  <div>
    <div class="d-flex gap-4">
      <RouterLink class="btn btn-primary mb-4" :to="{ name: 'restoreKey' }">Restore key</RouterLink>
      <AppButton class="btn btn-primary mb-4" @click="isImportECDSAKeyModalShown = true"
        >Import ECDSA Key</AppButton
      >
      <AppButton class="btn btn-primary mb-4" @click="isImportED25519KeyModalShown = true"
        >Import ED25519 Key</AppButton
      >
    </div>
    <div
      v-for="keyPair in keyPairsStore.keyPairs"
      :key="keyPair.public_key"
      class="rounded bg-dark-blue-800 p-4 mt-4"
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
        <AppButton size="small" color="primary" @click="handleShowDecryptModal(keyPair.public_key)"
          >Decrypt Private Key</AppButton
        >
      </div>
      <div class="form-group">
        <label class="form-label">Encrypted Private key</label>
        <AppInput readonly class="py-3" :filled="true" :model-value="keyPair.private_key" />
      </div>
      <div class="form-group mt-3">
        <label class="form-label"
          >{{
            PublicKey.fromString(keyPair.public_key)._key._type === 'secp256k1'
              ? 'ECDSA'
              : 'ED25519'
          }}
          Public key</label
        >
        <AppInput readonly class="py-3" :filled="true" :model-value="keyPair.public_key" />
      </div>
      <div
        v-show="
          keyPairsStore.accoundIds.find(acc => acc.publicKey === keyPair.public_key)?.accountIds[0]
        "
        class="form-group mt-3"
      >
        <label class="form-label">Account ID</label>
        <AppInput
          type="text"
          readonly
          class="py-3"
          :filled="true"
          :model-value="
            keyPairsStore.accoundIds.find(acc => acc.publicKey === keyPair.public_key)
              ?.accountIds[0]
          "
        />
      </div>
    </div>
    <AppModal v-model:show="isDecryptedModalShown" class="common-modal">
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isDecryptedModalShown = false"></i>
        </div>
        <div class="text-center mt-5">
          <Transition name="fade" mode="out-in">
            <i
              v-if="!decryptedKey"
              class="bi bi-lock large-icon cursor-pointer"
              @click="isDecryptedModalShown = false"
            ></i>
            <i
              v-else
              class="bi bi-unlock large-icon cursor-pointer"
              @click="isDecryptedModalShown = false"
            ></i>
          </Transition>
        </div>
        <form @submit="handleDecrypt">
          <h3 class="text-center text-title text-bold mt-5">Decrypt private key</h3>
          <div class="form-group mt-5">
            <label class="form-label">Enter your password</label>
            <AppInput
              v-model="userPassword"
              :filled="true"
              size="small"
              type="password"
              placeholder="Type your password"
            />
          </div>
          <div class="form-group mt-4">
            <label class="form-label">Decrypted Private key</label>
            <AppInput v-model="decryptedKey" :filled="true" size="small" readonly />
          </div>
          <div class="d-grid mt-5">
            <AppButton type="submit" color="primary" :disabled="userPassword.length === 0"
              >Decrypt</AppButton
            >
          </div>
        </form>
      </div>
    </AppModal>
    <AppModal v-model:show="isImportECDSAKeyModalShown" class="common-modal">
      <div class="p-5">
        <i class="bi bi-x-lg cursor-pointer" @click="isImportECDSAKeyModalShown = false"></i>
        <div class="text-center mt-5">
          <i class="bi bi-key large-icon" style="line-height: 16px"></i>
        </div>
        <form @submit="handleImportExternalKey">
          <div class="form-group mt-4">
            <label class="form-label">Enter your password</label>
            <AppInput
              v-model="userPassword"
              type="password"
              :filled="true"
              size="small"
              placeholder="Type your password"
            />
          </div>
          <div class="form-group mt-4">
            <label class="form-label">Enter nickname (optional)</label>
            <AppInput
              v-model="ecdsaKey.nickname"
              :filled="true"
              size="small"
              name="nickname"
              placeholder="Type nickname"
            />
          </div>
          <div class="form-group mt-4">
            <label class="form-label">Enter ECDSA Private key</label>
            <AppInput
              v-model="ecdsaKey.privateKey"
              :filled="true"
              size="small"
              name="private-key"
              placeholder="Type ECDSA Private key"
            />
          </div>
          <div class="d-grid mt-5">
            <AppButton type="submit" color="primary">Import</AppButton>
          </div>
        </form>
      </div>
    </AppModal>
    <AppModal v-model:show="isImportED25519KeyModalShown" class="common-modal">
      <div class="p-5">
        <i class="bi bi-x-lg cursor-pointer" @click="isImportED25519KeyModalShown = false"></i>
        <div class="text-center mt-5">
          <i class="bi bi-key large-icon"></i>
        </div>
        <form @submit="handleImportExternalED25519Key">
          <div class="form-group mt-4">
            <label class="form-label">Enter your password</label>
            <AppInput
              v-model="userPassword"
              type="password"
              :filled="true"
              size="small"
              placeholder="Type your password"
            />
          </div>
          <div class="form-group mt-4">
            <label class="form-label">Enter nickname (optional)</label>
            <AppInput
              v-model="ed25519Key.nickname"
              :filled="true"
              size="small"
              name="nickname"
              placeholder="Type nickname"
            />
          </div>
          <div class="form-group mt-4">
            <label class="form-label">Enter ED25519 Private key</label>
            <AppInput
              v-model="ed25519Key.privateKey"
              :filled="true"
              size="small"
              name="private-key"
              placeholder="Type ED25519 Private key"
            />
          </div>
          <div class="d-grid mt-5">
            <AppButton type="submit" color="primary">Import</AppButton>
          </div>
        </form>
      </div>
    </AppModal>
  </div>
</template>
