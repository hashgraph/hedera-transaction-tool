<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { PublicKey } from '@hashgraph/sdk';
import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';

import {
  decryptPrivateKey,
  deleteKeyPair,
  generateExternalKeyPairFromString,
} from '@renderer/services/keyPairService';
import { comparePasswords } from '@renderer/services/userService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Stores */
const keyPairsStore = useKeyPairsStore();
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();

enum Tabs {
  // ALL = 'All',
  RECOVERY_PHRASE = 'Imported from Recovery Phrase',
  PRIVATE_KEY = 'Imported from Private Key',
}

/* State */
const isDecryptedModalShown = ref(false);
const isDeleteModalShown = ref(false);
const isImportECDSAKeyModalShown = ref(false);
const isImportED25519KeyModalShown = ref(false);
const decryptedKeys = ref<{ decrypted: string | null; publicKey: string }[]>([]);
const publicKeysPrivateKeyToDecrypt = ref('');
const keyPairIdToDelete = ref<string | null>(null);
const userPassword = ref('');
const currentTab = ref(Tabs.RECOVERY_PHRASE);
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

const handleTabChange = (tab: Tabs) => {
  currentTab.value = tab;
};

const handleDecrypt = async e => {
  e.preventDefault();

  try {
    if (!user.data.isLoggedIn) {
      throw Error('No user selected');
    }

    const keyFromDecrypted = decryptedKeys.value.find(
      kp => kp.publicKey === publicKeysPrivateKeyToDecrypt.value,
    );

    if (!keyFromDecrypted) {
      const decryptedKey = await decryptPrivateKey(
        user.data.id,
        userPassword.value,
        publicKeysPrivateKeyToDecrypt.value,
      );

      decryptedKeys.value.push({
        publicKey: publicKeysPrivateKeyToDecrypt.value,
        decrypted: decryptedKey,
      });
    }

    isDecryptedModalShown.value = false;
  } catch (err: any) {
    toast.error('Failed to decrypt private key', { position: 'bottom-right' });
  }
};

const handleHideDecryptedKey = (publicKey: string) => {
  const keyFromDecryptedIndex = decryptedKeys.value.findIndex(kp => kp.publicKey === publicKey);

  if (keyFromDecryptedIndex >= 0) {
    decryptedKeys.value.splice(keyFromDecryptedIndex, 1);
    decryptedKeys.value = [...decryptedKeys.value];
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
      isDeleteModalShown.value = false;
      await keyPairsStore.refetch();

      if (user.data.secretHashes.length === 0) {
        router.push({ name: 'accountSetup' });
      }
    }
  } catch (err: any) {
    toast.error('Failed to delete key pair', { position: 'bottom-right' });
  }
};

const handleImportExternalKey = async (type: 'ED25519' | 'ECDSA') => {
  try {
    const privateKey = type === 'ED25519' ? ed25519Key.privateKey : ecdsaKey.privateKey;
    const nickname = type === 'ED25519' ? ed25519Key.nickname : ecdsaKey.nickname;

    const keyPair: Prisma.KeyPairUncheckedCreateInput = {
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

const handleCopy = (text: string, message: string) => {
  navigator.clipboard.writeText(text);
  toast.success(message, { position: 'bottom-right' });
};

/* Hooks */
onMounted(async () => {
  await keyPairsStore.refetch();
});

/* Watchers */
watch(isDecryptedModalShown, newVal => {
  if (!newVal) {
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
  <div class="d-flex justify-content-between mb-3">
    <div class="btn-group-container" role="group">
      <template v-for="(tab, index) in Object.values(Tabs)" :key="tab">
        <button
          type="button"
          class="btn btn-primary"
          :class="{ active: tab === currentTab, 'ms-3': index !== 0 }"
          @click="handleTabChange(tab)"
        >
          {{ tab }}
        </button>
      </template>
    </div>

    <div class="d-flex justify-content-end align-items-center">
      <RouterLink class="btn btn-secondary me-4" :to="{ name: 'restoreKey' }">Restore</RouterLink>

      <div class="dropdown">
        <AppButton
          color="primary"
          class="w-100 d-flex align-items-center justify-content-center"
          data-bs-toggle="dropdown"
          ><i class="bi bi-plus text-main me-2"></i> Import</AppButton
        >
        <ul class="dropdown-menu w-100 mt-3">
          <li class="dropdown-item cursor-pointer" @click="isImportED25519KeyModalShown = true">
            <span class="text-small">ED25519 Key</span>
          </li>
          <li class="dropdown-item cursor-pointer mt-3" @click="isImportECDSAKeyModalShown = true">
            <span class="text-small">ECDSA Key</span>
          </li>
        </ul>
      </div>
    </div>
  </div>

  <div class="mt-4">
    <div class="overflow-auto">
      <table class="table-custom">
        <thead>
          <tr>
            <th v-if="currentTab === Tabs.RECOVERY_PHRASE" class="w-10 text-end">Index</th>
            <th>Nickname</th>
            <th>Account ID</th>
            <th>Key Type</th>
            <th>Public Key</th>
            <th>Private Key</th>
            <th></th>
          </tr>
        </thead>
        <tbody class="text-secondary">
          <template
            v-for="keyPair in keyPairsStore.keyPairs.filter(item =>
              currentTab === Tabs.RECOVERY_PHRASE
                ? item.secret_hash !== null
                : item.secret_hash === null,
            )"
            :key="keyPair.public_key"
          >
            <tr>
              <td v-if="currentTab === Tabs.RECOVERY_PHRASE" class="text-end">
                {{ keyPair.index }}
              </td>
              <td>
                {{ keyPair.nickname || 'N/A' }}
              </td>
              <td>
                {{
                  keyPairsStore.publicKeyToAccounts.find(
                    acc => acc.publicKey === keyPair.public_key,
                  )?.accounts[0]?.account || 'N/A'
                }}
              </td>
              <td>
                {{
                  PublicKey.fromString(keyPair.public_key)._key._type === 'secp256k1'
                    ? 'ECDSA'
                    : 'ED25519'
                }}
              </td>
              <td>
                <p class="d-flex text-nowrap">
                  <span class="d-inline-block text-truncate" style="width: 12vw">{{
                    keyPair.public_key
                  }}</span>
                  <span
                    class="bi bi-copy cursor-pointer ms-3"
                    @click="handleCopy(keyPair.public_key, 'Public Key copied successfully')"
                  ></span>
                </p>
              </td>
              <td>
                <p class="d-flex text-nowrap">
                  <template v-if="decryptedKeys.find(kp => kp.publicKey === keyPair.public_key)">
                    <span class="d-inline-block text-truncate" style="width: 12vw">{{
                      decryptedKeys.find(kp => kp.publicKey === keyPair.public_key)?.decrypted
                    }}</span>
                    <span
                      class="bi bi-copy cursor-pointer ms-3"
                      @click="
                        handleCopy(
                          decryptedKeys.find(kp => kp.publicKey === keyPair.public_key)
                            ?.decrypted || '',
                          'Private Key copied successfully',
                        )
                      "
                    ></span>
                    <span
                      class="bi bi-eye-slash cursor-pointer ms-3"
                      @click="handleHideDecryptedKey(keyPair.public_key)"
                    ></span>
                  </template>
                  <template v-else>
                    {{ '*'.repeat(16) }}
                    <span
                      class="bi bi-eye cursor-pointer ms-3"
                      @click="handleShowDecryptModal(keyPair.public_key)"
                    ></span>
                  </template>
                </p>
              </td>
              <td class="text-center">
                <AppButton
                  size="small"
                  color="danger"
                  :outline="true"
                  @click="handleDeleteModal(keyPair.id)"
                  class="min-w-unset"
                  ><span class="bi bi-trash"></span
                ></AppButton>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <AppModal v-model:show="isDecryptedModalShown" class="common-modal">
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isDecryptedModalShown = false"></i>
        </div>
        <div class="text-center">
          <AppCustomIcon :name="'lock'" style="height: 160px" />
        </div>
        <form @submit="handleDecrypt">
          <h3 class="text-center text-title text-bold mt-3">Decrypt private key</h3>
          <div class="form-group mt-5">
            <label class="form-label">Enter your password</label>
            <AppInput
              v-model="userPassword"
              :filled="true"
              type="password"
              placeholder="Type your password"
            />
          </div>
          <hr class="separator my-5" />

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
        <div class="text-center">
          <AppCustomIcon :name="'bin'" style="height: 160px" />
        </div>
        <form @submit="handleDelete">
          <h3 class="text-center text-title text-bold mt-3">Delete key pair</h3>
          <p
            v-if="
              keyPairsStore.keyPairs.filter(item => item.secret_hash != null).length === 1 &&
              keyPairsStore.keyPairs
                .filter(item => item.secret_hash != null)
                .map(k => k.id)
                .includes(keyPairIdToDelete || '')
            "
            class="text-center mt-4"
          >
            You are about the delete the last key pair associated with your recovery phrase you have
            used to set up the Transaction Tool. If you choose to proceed, you will have to go
            through creating or importing a recovery phrase again. Do you wish to continue?
          </p>
          <div class="d-grid mt-5">
            <AppButton type="submit" color="danger" :outline="true">Delete</AppButton>
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
          <hr class="separator my-5" />

          <div class="d-grid">
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
          <hr class="separator my-5" />

          <div class="d-grid">
            <AppButton type="submit" color="primary">Import</AppButton>
          </div>
        </form>
      </div>
    </AppModal>
  </div>
</template>
