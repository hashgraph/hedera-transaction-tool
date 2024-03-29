<script setup lang="ts">
import { ref, watch } from 'vue';
import { PublicKey } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';

import { deleteKey, getUserState } from '@renderer/services/organization';
import { decryptPrivateKey, deleteKeyPair } from '@renderer/services/keyPairService';

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
  ALL = 'All',
  RECOVERY_PHRASE = 'Imported from Recovery Phrase',
  PRIVATE_KEY = 'Imported from Private Key',
}

/* State */
const isDecryptedModalShown = ref(false);
const isDeleteModalShown = ref(false);

const decryptedKeys = ref<{ decrypted: string | null; publicKey: string }[]>([]);
const publicKeysPrivateKeyToDecrypt = ref('');
const keyPairIdToDelete = ref<string | null>(null);
const userPassword = ref('');
const currentTab = ref(Tabs.ALL);

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
      if (user.data.activeOrganization && user.data.organizationState && user.data.organizationId) {
        const organizationKeyToDelete = getUserKeyToDelete();
        await deleteKey(
          user.data.activeOrganization.id,
          user.data.organizationId,
          organizationKeyToDelete.id,
        );
        const userState = await getUserState(
          user.data.activeOrganization.serverUrl,
          user.data.organizationId,
        );
        user.data.organizationState = userState;
      }

      await deleteKeyPair(keyPairIdToDelete.value);
      await keyPairsStore.refetch();
      isDeleteModalShown.value = false;

      if (user.shouldSetupAccount(keyPairsStore.keyPairs)) {
        router.push({ name: 'accountSetup' });
      }
    }
  } catch (err: any) {
    toast.error(err.message || 'Failed to delete key pair', { position: 'bottom-right' });
  }
};

const handleCopy = (text: string, message: string) => {
  navigator.clipboard.writeText(text);
  toast.success(message, { position: 'bottom-right' });
};

/* Functions */
function getUserKeyToDelete() {
  const localKey = keyPairsStore.keyPairs.find(kp => kp.id === keyPairIdToDelete.value);
  if (!localKey) {
    throw Error('Local key not found');
  }

  const organiationKey = user.data.organizationState?.organizationKeys.find(key => {
    if (localKey.secret_hash) {
      return key.mnemonicHash === localKey.secret_hash && key.publicKey === localKey.public_key;
    } else {
      return !key.mnemonicHash && key.publicKey === localKey.public_key;
    }
  });

  if (!organiationKey) {
    throw Error('Organization key not found');
  }

  return organiationKey;
}

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
</script>
<template>
  <div class="flex-column-100">
    <div class="mb-3">
      <template v-for="tab in Object.values(Tabs)" :key="tab">
        <AppButton
          type="button"
          color="borderless"
          class="min-w-unset"
          @click="handleTabChange(tab)"
        >
          {{ tab }}
        </AppButton>
      </template>
    </div>
    <div class="fill-remaining mt-4">
      <div class="overflow-auto">
        <table class="table-custom">
          <thead>
            <tr>
              <th
                v-if="currentTab === Tabs.RECOVERY_PHRASE || currentTab === Tabs.ALL"
                class="w-10 text-end"
              >
                Index
              </th>
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
              v-for="keyPair in keyPairsStore.keyPairs.filter(item => {
                switch (currentTab) {
                  case Tabs.ALL:
                    return true;
                  case Tabs.RECOVERY_PHRASE:
                    return item.secret_hash !== null;
                  case Tabs.PRIVATE_KEY:
                    return item.secret_hash === null;
                }
              })"
              :key="keyPair.public_key"
            >
              <tr>
                <td
                  v-if="currentTab === Tabs.RECOVERY_PHRASE || currentTab === Tabs.ALL"
                  class="text-end"
                >
                  {{ keyPair.index >= 0 ? keyPair.index : 'N/A' }}
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
              You are about the delete the last key pair associated with your recovery phrase you
              have used to set up the Transaction Tool. If you choose to proceed, you will have to
              go through creating or importing a recovery phrase again. Do you wish to continue?
            </p>
            <div class="d-grid mt-5">
              <AppButton type="submit" color="danger">Delete</AppButton>
            </div>
          </form>
        </div>
      </AppModal>
    </div>
  </div>
</template>
