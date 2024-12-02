<script setup lang="ts">
import type { USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import { computed, inject, ref, watch } from 'vue';
import { PublicKey } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';

import { CommonNetwork } from '@main/shared/enums';

import { deleteKey } from '@renderer/services/organization';
import { decryptPrivateKey, deleteKeyPair } from '@renderer/services/keyPairService';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';

import { USER_PASSWORD_MODAL_KEY } from '@renderer/providers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import UpdateNicknameModal from '@renderer/components/KeyPair/UpdateNicknameModal.vue';

/* Stores */
const user = useUserStore();
console.log(user.keyPairs.length);
const network = useNetworkStore();
/* Composables */
const toast = useToast();
const router = useRouter();

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

enum Tabs {
  ALL = 'All',
  RECOVERY_PHRASE = 'Imported from Recovery Phrase',
  PRIVATE_KEY = 'Imported from Private Key',
}

/* State */
const isDeleteModalShown = ref(false);
const isUpdateNicknameModalShown = ref(false);
const deleteAll = ref(false);

const decryptedKeys = ref<{ decrypted: string | null; publicKey: string }[]>([]);
const publicKeysPrivateKeyToDecrypt = ref('');
const keyPairIdToDelete = ref<string | null>(null);
const keyPairIdToEdit = ref<string | null>(null);
const missingKeyPairIdToDelete = ref<number | null>(null);
const currentTab = ref(Tabs.ALL);
const isDeletingKey = ref(false);

const modalMessage = computed(() =>
  deleteAll.value
    ? 'You are about to delete all key pairs. If you choose to proceed, you will have to go through creating or importing a recovery phrase again. Do you wish to continue?'
    : user.keyPairs.filter(item => item.secret_hash != null).length === 1 &&
        user.keyPairs[0].id === keyPairIdToDelete.value
      ? 'You are about to delete the last key pair associated with the recovery phrase you have used to set up the Transaction Tool. If you choose to proceed, you will have to go through creating or importing a recovery phrase again. Do you wish to continue?'
      : 'You are about to delete the selected key pair. Do you wish to continue?',
);

/* Computed */
const externalMissingKeys = computed(() =>
  isLoggedInOrganization(user.selectedOrganization)
    ? user.selectedOrganization.userKeys.filter(
        key => !user.keyPairs.find(kp => kp.public_key === key.publicKey),
      )
    : [],
);

/* Handlers */
const handleShowPrivateKey = async (publicKey: string) => {
  publicKeysPrivateKeyToDecrypt.value = publicKey;
  await decrypt();
};

const handleTabChange = (tab: Tabs) => {
  currentTab.value = tab;
};

const decrypt = async () => {
  try {
    if (!isUserLoggedIn(user.personal)) throw Error('User is not logged in');
    const personalPassword = user.getPassword();
    if (!personalPassword && !user.personal.useKeychain) {
      if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
      userPasswordModalRef.value?.open(
        'Enter your application password',
        'Enter your application password to decrypt your key',
        decrypt,
      );
      return;
    }

    const keyFromDecrypted = decryptedKeys.value.find(
      kp => kp.publicKey === publicKeysPrivateKeyToDecrypt.value,
    );

    if (!keyFromDecrypted) {
      const decryptedKey = await decryptPrivateKey(
        user.personal.id,
        personalPassword,
        publicKeysPrivateKeyToDecrypt.value,
      );

      decryptedKeys.value.push({
        publicKey: publicKeysPrivateKeyToDecrypt.value,
        decrypted: decryptedKey,
      });
    }
  } catch {
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
  if (deleteAll.value) {
    deleteAll.value = false;
  }
  keyPairIdToDelete.value = keyId;
  isDeleteModalShown.value = true;
};

const handleMissingKeyDeleteModal = (id: number) => {
  missingKeyPairIdToDelete.value = id;
  isDeleteModalShown.value = true;
};

const handleDelete = async (e: Event) => {
  e.preventDefault();

  try {
    isDeletingKey.value = true;

    if (!isUserLoggedIn(user.personal)) {
      throw Error('User is not logged in');
    }
    if (keyPairIdToDelete.value || deleteAll.value) {
      if (isLoggedInOrganization(user.selectedOrganization)) {
        const organizationKeyToDelete = getUserKeyToDelete();
        await deleteKey(
          user.selectedOrganization.serverUrl,
          user.selectedOrganization.userId,
          organizationKeyToDelete.id,
        );

        await user.refetchUserState();
      }
      if (deleteAll.value) {
        for (const key of user.keyPairs) {
          await deleteKeyPair(key.id);
          toast.success(`All private keys deleted successfully`, { position: 'bottom-right' });
        }
      } else {
        await deleteKeyPair(keyPairIdToDelete.value);
        toast.success(`Private key deleted successfully`, { position: 'bottom-right' });
      }
      await user.refetchKeys();
      user.refetchAccounts();

      isDeleteModalShown.value = false;

      if (user.shouldSetupAccount) {
        router.push({ name: 'accountSetup' });
      }
    } else if (
      missingKeyPairIdToDelete.value &&
      isLoggedInOrganization(user.selectedOrganization)
    ) {
      await deleteKey(
        user.selectedOrganization.serverUrl,
        user.selectedOrganization.userId,
        missingKeyPairIdToDelete.value,
      );
      await user.refetchUserState();
      toast.success(`Private key deleted successfully`, { position: 'bottom-right' });
    }
  } catch (err: any) {
    toast.error(err.message || 'Failed to delete key pair', { position: 'bottom-right' });
  } finally {
    keyPairIdToDelete.value = null;
    missingKeyPairIdToDelete.value = null;
    isDeletingKey.value = false;
    isDeleteModalShown.value = false;
    deleteAll.value = false;
  }
};

const handleCopy = (text: string, message: string) => {
  navigator.clipboard.writeText(text);
  toast.success(message, { position: 'bottom-right' });
};

const handleStartNicknameEdit = (id: string) => {
  keyPairIdToEdit.value = id;
  isUpdateNicknameModalShown.value = true;
};

const handleRemoveAllClick = () => {
  deleteAll.value = true;
  keyPairIdToDelete.value = null;
  isDeleteModalShown.value = true;
};

/* Functions */
function getUserKeyToDelete() {
  const localKey = user.keyPairs.find(kp => kp.id === keyPairIdToDelete.value);
  if (!localKey) {
    throw Error('Local key not found');
  }

  if (!isLoggedInOrganization(user.selectedOrganization)) {
    throw Error('User is not logged in the organization');
  }

  const organiationKey = user.selectedOrganization.userKeys.find(
    key => key.publicKey === localKey.public_key,
  );

  if (!organiationKey) {
    throw Error('Organization key not found');
  }

  return organiationKey;
}

/* Watchers */
watch(isDeleteModalShown, newVal => {
  if (!newVal) {
    keyPairIdToDelete.value = null;
  }
});
</script>
<template>
  <div class="flex-column-100">
    <div
      class="mb-3 d-flex flex-row justify-content-between flex-nowrap overflow-x-auto text-nowrap"
    >
      <template v-for="(tab, i) in Object.values(Tabs)" :key="tab">
        <AppButton
          :data-testid="`tab-${tab}`"
          type="button"
          color="borderless"
          class="min-w-unset"
          :class="[tab === currentTab ? 'active' : '', i !== 0 ? 'ms-3' : '']"
          @click="handleTabChange(tab)"
        >
          {{ tab }}
        </AppButton>
        <AppButton
          v-if="i === Object.values(Tabs).length - 1"
          class="min-w-unset ms-3"
          color="danger"
          data-testid="button-remove-account-card"
          @click="handleRemoveAllClick"
        >
          <span class="bi bi-trash"></span> Remove All
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
              v-for="(keyPair, index) in user.keyPairs.filter(item => {
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
                  :data-testid="`cell-index-${index}`"
                  v-if="currentTab === Tabs.RECOVERY_PHRASE || currentTab === Tabs.ALL"
                  class="text-end"
                >
                  {{ keyPair.index >= 0 ? keyPair.index : 'N/A' }}
                </td>
                <td :data-testid="`cell-nickname-${index}`">
                  <span
                    class="bi bi-pencil-square text-main text-primary me-3 cursor-pointer"
                    data-testid="button-change-key-nickname"
                    @click="handleStartNicknameEdit(keyPair.id)"
                  ></span>
                  {{ keyPair.nickname || 'N/A' }}
                </td>
                <td :data-testid="`cell-account-${index}`">
                  <span
                    v-if="
                      user.publicKeyToAccounts.find(acc => acc.publicKey === keyPair.public_key)
                        ?.accounts[0]?.account
                    "
                    :class="{
                      'text-mainnet': network.network === CommonNetwork.MAINNET,
                      'text-testnet': network.network === CommonNetwork.TESTNET,
                      'text-previewnet': network.network === CommonNetwork.PREVIEWNET,
                      'text-info': ![
                        CommonNetwork.MAINNET,
                        CommonNetwork.TESTNET,
                        CommonNetwork.PREVIEWNET,
                      ].includes(network.network),
                    }"
                  >
                    {{
                      user.publicKeyToAccounts.find(acc => acc.publicKey === keyPair.public_key)
                        ?.accounts[0]?.account
                    }}
                  </span>
                  <span v-else>N/A</span>
                </td>
                <td :data-testid="`cell-key-type-${index}`">
                  {{
                    PublicKey.fromString(keyPair.public_key)._key._type === 'secp256k1'
                      ? 'ECDSA'
                      : 'ED25519'
                  }}
                </td>
                <td>
                  <p class="d-flex text-nowrap">
                    <span
                      :data-testid="`span-public-key-${index}`"
                      class="d-inline-block text-truncate"
                      style="width: 12vw"
                      >{{ keyPair.public_key }}</span
                    >
                    <span
                      :data-testid="`span-copy-public-key-${index}`"
                      class="bi bi-copy cursor-pointer ms-3"
                      @click="handleCopy(keyPair.public_key, 'Public Key copied successfully')"
                    ></span>
                  </p>
                </td>
                <td>
                  <p class="d-flex text-nowrap">
                    <template v-if="decryptedKeys.find(kp => kp.publicKey === keyPair.public_key)">
                      <span
                        :data-testid="`span-private-key-${index}`"
                        class="d-inline-block text-truncate"
                        style="width: 12vw"
                        >{{
                          decryptedKeys.find(kp => kp.publicKey === keyPair.public_key)?.decrypted
                        }}</span
                      >
                      <span
                        :data-testid="`span-copy-private-key-${index}`"
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
                        :data-testid="`span-hide-private-key-${index}`"
                        class="bi bi-eye-slash cursor-pointer ms-3"
                        @click="handleHideDecryptedKey(keyPair.public_key)"
                      ></span>
                    </template>
                    <template v-else>
                      {{ '*'.repeat(16) }}
                      <span
                        :data-testid="`span-show-modal-${index}`"
                        class="bi bi-eye cursor-pointer ms-3"
                        @click="handleShowPrivateKey(keyPair.public_key)"
                      ></span>
                    </template>
                  </p>
                </td>
                <td class="text-center">
                  <AppButton
                    size="small"
                    color="danger"
                    :data-testid="`button-delete-key-${index}`"
                    @click="handleDeleteModal(keyPair.id)"
                    class="min-w-unset"
                    ><span class="bi bi-trash"></span
                  ></AppButton>
                </td>
              </tr>
            </template>
            <template
              v-if="
                (currentTab === Tabs.ALL || currentTab === Tabs.PRIVATE_KEY) &&
                isLoggedInOrganization(user.selectedOrganization)
              "
            >
              <template v-for="(keyPair, index) in externalMissingKeys" :key="keyPair.publicKey">
                <tr class="disabled-w-action position-relative">
                  <td v-if="currentTab === Tabs.ALL" :data-testid="`cell-index-missing-${index}`">
                    N/A
                  </td>
                  <td :data-testid="`cell-nickname-missing-${index}`">N/A</td>
                  <td :data-testid="`cell-account-missing-${index}`">
                    <span
                      v-if="
                        user.publicKeyToAccounts.find(acc => acc.publicKey === keyPair.publicKey)
                          ?.accounts[0]?.account
                      "
                      :class="{
                        'text-mainnet': network.network === 'mainnet',
                        'text-testnet': network.network === 'testnet',
                        'text-previewnet': network.network === 'previewnet',
                        'text-info': network.network === 'local-node',
                      }"
                    >
                      {{
                        user.publicKeyToAccounts.find(acc => acc.publicKey === keyPair.publicKey)
                          ?.accounts[0]?.account
                      }}
                    </span>
                    <span v-else>N/A</span>
                  </td>
                  <td :data-testid="`cell-key-type-missing-${index}`">
                    {{
                      PublicKey.fromString(keyPair.publicKey)._key._type === 'secp256k1'
                        ? 'ECDSA'
                        : 'ED25519'
                    }}
                  </td>
                  <td>
                    <p class="d-flex text-nowrap">
                      <span
                        :data-testid="`span-public-key-missing-${index}`"
                        class="d-inline-block text-truncate"
                        style="width: 12vw"
                        >{{ keyPair.publicKey }}</span
                      >
                      <span
                        :data-testid="`span-copy-public-key-missing-${index}`"
                        class="bi bi-copy cursor-pointer ms-3"
                        @click="handleCopy(keyPair.publicKey, 'Public Key copied successfully')"
                      ></span>
                    </p>
                  </td>
                  <td>
                    <p class="d-flex text-nowrap">N/A</p>
                  </td>
                  <td class="text-center">
                    <AppButton
                      size="small"
                      color="danger"
                      :data-testid="`button-delete-key-${index}`"
                      @click="handleMissingKeyDeleteModal(keyPair.id)"
                      class="min-w-unset"
                      >Delete missing key</AppButton
                    >
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>

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
            <p class="text-center mt-4">
              {{ modalMessage }}
            </p>
            <div class="d-grid mt-5">
              <AppButton
                type="submit"
                data-testid="button-delete-keypair"
                color="danger"
                :disabled="isDeletingKey"
                :loading="isDeletingKey"
                loading-text="Deleting..."
                >Delete</AppButton
              >
            </div>
          </form>
        </div>
      </AppModal>

      <UpdateNicknameModal
        v-model:show="isUpdateNicknameModalShown"
        :key-pair-id="keyPairIdToEdit || ''"
      />
    </div>
  </div>
</template>
