<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { PublicKey } from '@hashgraph/sdk';

import { RESTORE_MISSING_KEYS } from '@renderer/router';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { CommonNetwork } from '@main/shared/enums';

import { deleteKey } from '@renderer/services/organization';
import { decryptPrivateKey, deleteKeyPair } from '@renderer/services/keyPairService';

import {
  assertUserLoggedIn,
  getErrorMessage,
  isLoggedInOrganization,
  safeAwait,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppDropDown from '@renderer/components/ui/AppDropDown.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import UpdateNicknameModal from '@renderer/components/KeyPair/UpdateNicknameModal.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const { getPassword, passwordModalOpened } = usePersonalPassword();

enum Tabs {
  ALL = 'All',
  RECOVERY_PHRASE = 'Imported from Recovery Phrase',
  PRIVATE_KEY = 'Imported from Private Key',
}

/* State */
const isDeleteModalShown = ref(false);
const isUpdateNicknameModalShown = ref(false);
const deleteAll = ref(false);
const isSelectMany = ref(false);
const selectedKeyPairIdsToDelete = ref<string[]>([]);
const selectedMissingKeyPairIdsToDelete = ref<string[]>([]);

const decryptedKeys = ref<{ decrypted: string | null; publicKey: string }[]>([]);
const publicKeysPrivateKeyToDecrypt = ref('');
const keyPairIdToDelete = ref<string | null>(null);
const keyPairIdToEdit = ref<string | null>(null);
const missingKeyPairIdToDelete = ref<number | null>(null);
const currentTab = ref(Tabs.ALL);
const isDeletingKey = ref(false);
const selectedRecoveryPhrase = ref<string>('');

/* Computed */
const missingKeys = computed(() =>
  isLoggedInOrganization(user.selectedOrganization)
    ? user.selectedOrganization.userKeys.filter(
        key => !user.keyPairs.some(kp => kp.public_key === key.publicKey),
      )
    : [],
);

const recoveryPhraseHashes = computed(() =>
  (isLoggedInOrganization(user.selectedOrganization)
    ? user.selectedOrganization.secretHashes
    : user.secretHashes
  ).map((hash, i) => ({ label: `Recovery Phrase ${i + 1}`, value: hash })),
);

const listedKeyPairs = computed(() => {
  return user.keyPairs.filter(item => {
    switch (currentTab.value) {
      case Tabs.ALL:
        return true;
      case Tabs.RECOVERY_PHRASE:
        return item.secret_hash !== null && item.secret_hash === selectedRecoveryPhrase.value;
      case Tabs.PRIVATE_KEY:
        return item.secret_hash === null;
    }
  });
});

const listedMissingKeyPairs = computed(() => {
  return missingKeys.value.filter(keyPair => {
    return (
      currentTab.value === Tabs.ALL ||
      (currentTab.value === Tabs.RECOVERY_PHRASE &&
        keyPair.mnemonicHash &&
        keyPair.mnemonicHash === selectedRecoveryPhrase.value) ||
      (currentTab.value === Tabs.PRIVATE_KEY && !keyPair.mnemonicHash)
    );
  });
});

const modalMessage = computed(() => {
  if (currentTab.value === Tabs.PRIVATE_KEY) {
    if (deleteAll.value) {
      return 'You are about to delete all key pairs imported from private keys. Do you wish to continue?';
    }
  }

  if (deleteAll.value && currentTab.value === Tabs.ALL) {
    return 'You are about to delete all key pairs. If you choose to proceed, you will have to go through creating or importing a recovery phrase again. Do you wish to continue?';
  }

  if (currentTab.value === Tabs.RECOVERY_PHRASE && deleteAll.value) {
    return 'You are about to delete all key pairs associated with the recovery phrase you have selected. If you choose to proceed, you will have to go through creating or importing a recovery phrase again. Do you wish to continue?';
  }

  return 'You are about to delete the selected key pair(s). Do you wish to continue?';
});

/* Handlers */
const handleShowPrivateKey = async (publicKey: string) => {
  publicKeysPrivateKeyToDecrypt.value = publicKey;
  await decrypt();
};

const handleTabChange = (tab: Tabs) => {
  currentTab.value = tab;
  selectedRecoveryPhrase.value = '';
};

const decrypt = async () => {
  try {
    assertUserLoggedIn(user.personal);
    const personalPassword = getPassword(decrypt, {
      subHeading: 'Enter your application password to decrypt your key',
    });
    if (passwordModalOpened(personalPassword)) return;

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
    toast.error('Failed to decrypt private key');
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

const handleDelete = async () => {
  try {
    isDeletingKey.value = true;

    const deleteSingleKey = async (keyId: string | number) => {
      const organizationKeyToDelete = getUserKeyToDelete(keyId.toString());
      const organizationKeyIdToDelete = organizationKeyToDelete?.id || null;

      //localId in the parameter : string only

      // two arrays for missingKeys number[]
      // localKeys string[]

      // safeAwait for all missing keys (backend)

      await deleteKeyPair(keyId.toString());

      if (organizationKeyIdToDelete && isLoggedInOrganization(user.selectedOrganization)) {
        await safeAwait(
          deleteKey(
            user.selectedOrganization.serverUrl,
            user.selectedOrganization.userId,
            organizationKeyIdToDelete,
          ),
        );
      }
    };

    if (deleteAll.value) {
      const deleteAllKeys = async () => {
        if (listedKeyPairs.value) {
          for (const key of listedKeyPairs.value) {
            await deleteSingleKey(key.id);
          }
        }

        if (listedMissingKeyPairs.value) {
          for (const key of listedMissingKeyPairs.value) {
            await deleteSingleKey(key.id);
          }
        }
      };

      await deleteAllKeys();

      toast.success('All keys deleted successfully', { position: 'bottom-right' });

      await user.refetchUserState();
      await user.refetchKeys();
      user.refetchAccounts();

      if (user.shouldSetupAccount) {
        router.push({ name: 'accountSetup' });
      }
      return;
    }

    if (keyPairIdToDelete.value) {
      await deleteSingleKey(keyPairIdToDelete.value);
    } else if (missingKeyPairIdToDelete.value) {
      await deleteSingleKey(missingKeyPairIdToDelete.value);
    }

    toast.success('Private key deleted successfully');

    await user.refetchUserState();
    await user.refetchKeys();
    user.refetchAccounts();

    if (user.shouldSetupAccount) {
      router.push({ name: 'accountSetup' });
    }
  } catch (err: unknown) {
    toast.error(getErrorMessage(err, 'Failed to delete key pair'));
  } finally {
    keyPairIdToDelete.value = null;
    missingKeyPairIdToDelete.value = null;
    isDeletingKey.value = false;
    isDeleteModalShown.value = false;
    deleteAll.value = false;
  }
};

const handleSelectMany = () => {
  isSelectMany.value = !isSelectMany.value;
  const allListedKeyPairsIds = listedKeyPairs.value.map(key => key.id);
  const allListedMissingKeyPairsIds = listedMissingKeyPairs.value.map(key => key.id.toString());
  if (isSelectMany.value) {
    selectedKeyPairIdsToDelete.value = allListedKeyPairsIds;
    selectedMissingKeyPairIdsToDelete.value = allListedMissingKeyPairsIds;
  } else {
    selectedKeyPairIdsToDelete.value = [];
    selectedMissingKeyPairIdsToDelete.value = [];
  }

  console.log(selectedKeyPairIdsToDelete.value);
  console.log(selectedMissingKeyPairIdsToDelete.value);
  console.log(selectedKeyPairIdsToDelete.value.length === listedKeyPairs.value.length);
};

const handleCheckBox = (keyPairId: string, isMissing: boolean) => {
  const arrayToChange = isMissing ? selectedMissingKeyPairIdsToDelete : selectedKeyPairIdsToDelete;
  const index = arrayToChange.value.indexOf(keyPairId);
  if (index > -1) {
    arrayToChange.value = arrayToChange.value.filter(id => id !== keyPairId);
  } else {
    arrayToChange.value = [...arrayToChange.value, keyPairId];
  }

  const checkLength = checkAllKeysSelected();

  if (checkLength) {
    isSelectMany.value = true;
  } else {
    isSelectMany.value = false;
  }
  console.log(selectedKeyPairIdsToDelete.value);
  console.log(isSelectMany.value);
};

const handleCopy = (text: string, message: string) => {
  navigator.clipboard.writeText(text);
  toast.success(message);
};

const handleStartNicknameEdit = (id: string) => {
  keyPairIdToEdit.value = id;
  isUpdateNicknameModalShown.value = true;
};

const handleRedirectToRecoverMnemonicKeys = () => {
  router.push({ name: RESTORE_MISSING_KEYS });
};
const handleRemoveClick = () => {
  if (isSelectMany.value) {
    deleteAll.value = true;
  } else {
    deleteAll.value = false;
  }
  keyPairIdToDelete.value = null;
  isDeleteModalShown.value = true;
};

/* Functions */
function getUserKeyToDelete(keyPairId: string) {
  const localKey = user.keyPairs.find(kp => kp.id === keyPairId);
  if (!localKey) {
    throw Error('Local key not found');
  }

  if (isLoggedInOrganization(user.selectedOrganization)) {
    return user.selectedOrganization.userKeys.find(key => key.publicKey === localKey.public_key);
  }

  return null;
}

const checkAllKeysSelected = () => {
  if (
    selectedKeyPairIdsToDelete.value.length === listedKeyPairs.value.length &&
    selectedMissingKeyPairIdsToDelete.value.length === listedMissingKeyPairs.value.length
  ) {
    return true;
  } else {
    return false;
  }
};

/* Watchers */
watch(isDeleteModalShown, newVal => {
  if (!newVal) {
    keyPairIdToDelete.value = null;
  }
});

watch(selectedRecoveryPhrase, newVal => {
  if (newVal) {
    currentTab.value = Tabs.RECOVERY_PHRASE;
  }
});

watch(isDeletingKey, () => {
  if (
    listedKeyPairs.value.length === 0 &&
    listedMissingKeyPairs.value.length === 0 &&
    currentTab.value === Tabs.RECOVERY_PHRASE
  ) {
    currentTab.value = Tabs.ALL;
  }
});

watch([currentTab, selectedRecoveryPhrase], () => {
  selectedKeyPairIdsToDelete.value = [];
  selectedMissingKeyPairIdsToDelete.value = [];
  isSelectMany.value = false;
});
</script>
<template>
  <div class="flex-column-100">
    <div class="d-flex align-items-center gap-4 mb-3">
      <div class="btn-group-container d-inline-flex w-100" role="group">
        <div class="btn-group gap-3 overflow-x-auto">
          <AppButton
            :color="currentTab === Tabs.ALL ? 'primary' : undefined"
            :data-testid="`tab-${Tabs.ALL}`"
            class="rounded-3 text-nowrap min-w-unset"
            :class="{
              active: currentTab === Tabs.ALL,
              'text-body': currentTab !== Tabs.ALL,
            }"
            @click="handleTabChange(Tabs.ALL)"
            >{{ Tabs.ALL }}</AppButton
          >

          <AppButton
            :color="currentTab === Tabs.PRIVATE_KEY ? 'primary' : undefined"
            :data-testid="`tab-${Tabs.PRIVATE_KEY}`"
            class="rounded-3 text-nowrap min-w-unset"
            :class="{
              active: currentTab === Tabs.PRIVATE_KEY,
              'text-body': currentTab !== Tabs.PRIVATE_KEY,
            }"
            @click="handleTabChange(Tabs.PRIVATE_KEY)"
            >{{ Tabs.PRIVATE_KEY }}</AppButton
          >
          <AppDropDown
            v-model:value="selectedRecoveryPhrase"
            :items="recoveryPhraseHashes"
            :toggle-text="Tabs.RECOVERY_PHRASE"
            :active="currentTab === Tabs.RECOVERY_PHRASE"
            :color="'primary'"
            button-class="rounded-3"
            class="text-nowrap"
            :style="{ maxWidth: '300px' }"
            toggler-icon
            color-on-active
          />
          <AppButton
            v-if="
              currentTab === Tabs.RECOVERY_PHRASE &&
              missingKeys.some(k => k.mnemonicHash === selectedRecoveryPhrase)
            "
            color="primary"
            :data-testid="`button-restore-lost-keys`"
            class="rounded-3 text-nowrap min-w-unset"
            @click="handleRedirectToRecoverMnemonicKeys()"
            >Restore Missing Keys</AppButton
          >

          <AppButton
            v-if="listedKeyPairs.length > 0 || listedMissingKeyPairs.length > 0"
            class="d-flex align-items-center rounded-3 text-nowrap min-w-unset"
            data-testid="button-select-many-accounts"
            :active="isSelectMany"
            @click="handleSelectMany"
            :color="checkAllKeysSelected() ? 'secondary' : undefined"
          >
            <i class="bi bi-check-all me-2"></i> Select all</AppButton
          >

          <AppButton
            v-if="listedKeyPairs.length > 0 || listedMissingKeyPairs.length > 0"
            class="rounded-3 text-nowrap min-w-unset"
            color="danger"
            :disabled="
              selectedKeyPairIdsToDelete.length === 0 &&
              selectedMissingKeyPairIdsToDelete.length === 0
            "
            data-testid="button-remove-all-keys"
            @click="handleRemoveClick"
          >
            <span class="bi bi-trash"></span> Remove
          </AppButton>
        </div>
      </div>
    </div>

    <div class="fill-remaining overflow-x-auto pe-4 pb-2 mt-4">
      <table class="table-custom">
        <thead>
          <tr>
            <th class="w-10 text-center">Select</th>
            <th
              v-if="currentTab === Tabs.RECOVERY_PHRASE || currentTab === Tabs.ALL"
              class="w-10 text-center"
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
          <template v-for="(keyPair, index) in listedKeyPairs" :key="keyPair.public_key">
            <tr>
              <td>
                <AppCheckBox
                  :checked="selectedKeyPairIdsToDelete.includes(keyPair.id) || isSelectMany"
                  @update:checked="handleCheckBox(keyPair.id, false)"
                  name="select-card"
                  :data-testid="'checkbox-multiple-keys-id-' + index"
                  class="cursor-pointer"
                />
              </td>
              <td
                :data-testid="`cell-index-${index}`"
                v-if="currentTab === Tabs.RECOVERY_PHRASE || currentTab === Tabs.ALL"
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
          <template v-if="isLoggedInOrganization(user.selectedOrganization)">
            <template v-for="(keyPair, index) in listedMissingKeyPairs" :key="keyPair.publicKey">
              <tr class="disabled-w-action position-relative">
                <td>
                  <AppCheckBox
                    :checked="
                      selectedMissingKeyPairIdsToDelete.includes(keyPair.id.toString()) ||
                      isSelectMany
                    "
                    @update:checked="handleCheckBox(keyPair.id.toString(), true)"
                    name="select-card"
                    :data-testid="'checkbox-multiple-keys-id-' + index"
                    class="cursor-pointer"
                  />
                </td>
                <td
                  v-if="currentTab === Tabs.RECOVERY_PHRASE || currentTab === Tabs.ALL"
                  :data-testid="`cell-index-missing-${index}`"
                  class="text-end"
                >
                  {{ keyPair.index != null && keyPair.index >= 0 ? keyPair.index : 'N/A' }}
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
      <AppModal v-model:show="isDeleteModalShown" class="common-modal">
        <div class="p-5">
          <div>
            <i class="bi bi-x-lg cursor-pointer" @click="isDeleteModalShown = false"></i>
          </div>
          <div class="text-center">
            <AppCustomIcon :name="'bin'" style="height: 160px" />
          </div>
          <form @submit.prevent="handleDelete">
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
