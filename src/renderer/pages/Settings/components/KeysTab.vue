<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { PublicKey } from '@hashgraph/sdk';
import { KeyPair } from '@prisma/client';

import useUserStore from '../../../stores/storeUser';
import useKeyPairsStore from '../../../stores/storeKeyPairs';

import { useToast } from 'vue-toast-notification';

import {
  decryptPrivateKey,
  deleteKeyPair,
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
const isDeleteModalShown = ref(false);
const isImportECDSAKeyModalShown = ref(false);
const isImportED25519KeyModalShown = ref(false);
const decryptedKey = ref('');
const publicKeysPrivateKeyToDecrypt = ref('');
const keyPairIdToDelete = ref<string | null>(null);
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

const handleDeleteModal = (keyId: string) => {
  keyPairIdToDelete.value = keyId;
  isDeleteModalShown.value = true;
};

const handleDelete = async e => {
  e.preventDefault();

  try {
    if (!user.data.isLoggedIn) {
      throw Error('No user selected');
    }

    if (keyPairIdToDelete.value) {
      await deleteKeyPair(keyPairIdToDelete.value);
      await keyPairsStore.refetch();
    }

    isDeleteModalShown.value = false;
  } catch (err: any) {
    toast.error('Failed to delete key pair', { position: 'bottom-right' });
  }
};

const handleImportExternalKey = async (type: 'ED25519' | 'ECDSA') => {
  try {
    const privateKey = type === 'ED25519' ? ed25519Key.privateKey : ecdsaKey.privateKey;
    const nickname = type === 'ED25519' ? ed25519Key.nickname : ecdsaKey.nickname;

    const keyPair: KeyPair = {
      id: '',
      user_id: user.data.id,
      ...generateExternalKeyPairFromString(privateKey, type, nickname || ''),
      organization_id: null,
      type: type,
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
    isImportECDSAKeyModalShown.value = false;

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
watch(isDeleteModalShown, newVal => {
  if (!newVal) {
    keyPairIdToDelete.value = null;
  }
});
watch([isImportECDSAKeyModalShown, isImportED25519KeyModalShown], () => {
  userPassword.value = '';
  ecdsaKey.nickname = '';
  ecdsaKey.privateKey = '';
  ed25519Key.nickname = '';
  ed25519Key.privateKey = '';
});
</script>
<template>
  <div class="d-flex mb-5">
    <RouterLink class="btn btn-primary me-4" :to="{ name: 'restoreKey' }">Restore key</RouterLink>
    <AppButton class="btn btn-primary me-4" @click="isImportED25519KeyModalShown = true"
      >Import ED25519 Key</AppButton
    >
    <AppButton class="btn btn-primary" @click="isImportECDSAKeyModalShown = true"
      >Import ECDSA Key</AppButton
    >
  </div>

  <div class="row">
    <div class="col-6 col-xxxl-5">
      <h2 class="text-main text-bold">Keys from recovery phrase:</h2>
      <div
        v-for="keyPair in keyPairsStore.keyPairs.filter(item => item.secret_hash != null)"
        :key="keyPair.public_key"
        class="rounded border bg-dark-blue-800 p-4 mt-4"
      >
        <div class="d-flex justify-content-between align-items-center">
          <div class="mb-3">
            <p class="text-small mb-3">
              <span class="text-secondary">Nickname: </span>
              <span class="text-bold">{{ keyPair.nickname || 'N/A' }} ({{ keyPair.type }})</span>
            </p>
            <p v-if="keyPair.index >= 0" class="text-small">
              <span class="text-secondary">Index: </span>
              <span class="text-bold">{{ keyPair.index }}</span>
            </p>
          </div>
          <div>
            <AppButton size="small" color="primary" @click="handleDeleteModal(keyPair.id)"
              >Delete</AppButton
            >
            <AppButton
              size="small"
              color="primary"
              @click="handleShowDecryptModal(keyPair.public_key)"
              class="ms-3"
              >Decrypt Private Key</AppButton
            >
          </div>
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
          <AppInput readonly :filled="true" :model-value="keyPair.public_key" />
        </div>
        <div
          v-show="
            keyPairsStore.accoundIds.find(acc => acc.publicKey === keyPair.public_key)
              ?.accountIds[0]
          "
          class="form-group mt-3"
        >
          <label class="form-label">Account ID</label>
          <AppInput
            type="text"
            readonly
            :filled="true"
            :model-value="
              keyPairsStore.accoundIds.find(acc => acc.publicKey === keyPair.public_key)
                ?.accountIds[0]
            "
          />
        </div>
      </div>
    </div>

    <div class="col-6 col-xxxl-5">
      <h2 class="text-main text-bold">Keys imported from PK:</h2>
      <div
        v-for="keyPair in keyPairsStore.keyPairs.filter(item => item.secret_hash === null)"
        :key="keyPair.public_key"
        class="rounded border bg-dark-blue-800 p-4 mt-4"
      >
        <div class="d-flex justify-content-between align-items-center">
          <div class="mb-3">
            <p v-if="keyPair.index >= 0" class="mb-3 text-small">
              <span class="text-secondary">Index: </span>
              <span class="text-bold">{{ keyPair.index }}</span>
            </p>
            <p class="text-small">
              <span class="text-secondary">Nickname: </span>
              <span class="text-bold">{{ keyPair.nickname || 'N/A' }} ({{ keyPair.type }})</span>
            </p>
          </div>
          <div>
            <AppButton size="small" color="primary" @click="handleDeleteModal(keyPair.id)"
              >Delete</AppButton
            >
            <AppButton
              size="small"
              color="primary"
              @click="handleShowDecryptModal(keyPair.public_key)"
              class="ms-3"
              >Decrypt Private Key</AppButton
            >
          </div>
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
          <AppInput readonly :filled="true" :model-value="keyPair.public_key" />
        </div>
        <div
          v-show="
            keyPairsStore.accoundIds.find(acc => acc.publicKey === keyPair.public_key)
              ?.accountIds[0]
          "
          class="form-group mt-3"
        >
          <label class="form-label">Account ID</label>
          <AppInput
            type="text"
            readonly
            :filled="true"
            :model-value="
              keyPairsStore.accoundIds.find(acc => acc.publicKey === keyPair.public_key)
                ?.accountIds[0]
            "
          />
        </div>
      </div>
    </div>

    <AppModal v-model:show="isDecryptedModalShown" class="common-modal">
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isDecryptedModalShown = false"></i>
        </div>
        <div class="text-center mt-5">
          <Transition name="fade" mode="out-in">
            <i v-if="!decryptedKey" class="bi bi-lock large-icon"></i>
            <i v-else class="bi bi-unlock large-icon"></i>
          </Transition>
        </div>
        <form @submit="handleDecrypt">
          <h3 class="text-center text-title text-bold mt-5">Decrypt private key</h3>
          <div class="form-group mt-5">
            <label class="form-label">Enter your password</label>
            <AppInput
              v-model="userPassword"
              :filled="true"
              type="password"
              placeholder="Type your password"
            />
          </div>
          <div class="form-group mt-4">
            <label class="form-label">Decrypted Private key</label>
            <AppInput v-model="decryptedKey" :filled="true" readonly />
          </div>
          <div class="d-grid mt-5">
            <AppButton type="submit" color="primary" :disabled="userPassword.length === 0"
              >Decrypt</AppButton
            >
          </div>
        </form>
      </div>
    </AppModal>

    <AppModal v-model:show="isDeleteModalShown" class="common-modal">
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isDeleteModalShown = false"></i>
        </div>
        <div class="text-center mt-5">
          <i class="bi bi-trash3 large-icon"></i>
        </div>
        <form @submit="handleDelete">
          <h3 class="text-center text-title text-bold mt-5">Delete key key pair</h3>
          <div class="form-group mt-4">
            <label class="form-label">Public key</label>
            <AppInput
              :value="
                keyPairsStore.keyPairs.find(kp => kp.id === keyPairIdToDelete)?.public_key || ''
              "
              :filled="true"
              size="small"
              readonly
            />
          </div>
          <div class="d-grid mt-5">
            <AppButton type="submit" color="primary">Delete</AppButton>
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
        <form
          @submit="
            e => {
              e.preventDefault();
              handleImportExternalKey('ECDSA');
            }
          "
        >
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
            <label class="form-label">Enter your password</label>
            <AppInput
              v-model="userPassword"
              type="password"
              :filled="true"
              size="small"
              placeholder="Type your password"
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
        <form
          @submit="
            e => {
              e.preventDefault();
              handleImportExternalKey('ED25519');
            }
          "
        >
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
            <label class="form-label">Enter your password</label>
            <AppInput
              v-model="userPassword"
              type="password"
              :filled="true"
              size="small"
              placeholder="Type your password"
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
