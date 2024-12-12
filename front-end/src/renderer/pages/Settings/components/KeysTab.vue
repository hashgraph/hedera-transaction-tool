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
const isSelectAll = ref(false);
const selectedKeyPairIdsToDelete = ref<string[]>([]);
const selectedMissingKeyPairIdsToDelete = ref<number[]>([]);
const selectMany = ref(false);

const decryptedKeys = ref<{ decrypted: string | null; publicKey: string }[]>([]);
const publicKeysPrivateKeyToDecrypt = ref('');
const keyPairIdToEdit = ref<string | null>(null);
const currentTab = ref(Tabs.ALL);
const isDeletingKey = ref(false);
const selectedRecoveryPhrase = ref<string>('');
const deleteSingleLocal = ref<string[]>([]);
const deleteSingleMissing = ref<number[]>([]);

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
  const recoveryPhraseKeyIds = user.keyPairs
    .filter(item => item.secret_hash != null)
    .map(item => item.id);

  const privateKeyIds = user.keyPairs.filter(item => item.secret_hash == null).map(item => item.id);

  const activeArray =
    deleteSingleLocal.value.length > 0 ? deleteSingleLocal : selectedKeyPairIdsToDelete;

  const allRecoveryPhraseKeyPairsSelected = recoveryPhraseKeyIds.every(id =>
    activeArray.value.includes(id),
  );

  const allPrivateKeyPairsSelected = privateKeyIds.every(id => activeArray.value.includes(id));

  if (deleteAll.value && currentTab.value === Tabs.ALL) {
    return 'You are about to delete all key pairs. If you choose to proceed, you will have to go through creating or importing a recovery phrase again. Do you wish to continue?';
  }

  if (allRecoveryPhraseKeyPairsSelected) {
    return 'You are about to delete all key pairs associated with recovery phrase. If you choose to proceed, you will have to go through creating or importing a recovery phrase again. Do you wish to continue?';
  }

  if (allPrivateKeyPairsSelected) {
    return 'You are about to delete all key pairs imported from private keys. Do you wish to continue?';
  }

  if (currentTab.value === Tabs.PRIVATE_KEY) {
    return 'You are about do delete the selected key pair(s) imported from a private key. Do you wish to continue?';
  }

  if (currentTab.value === Tabs.RECOVERY_PHRASE) {
    return 'You are about to delete the selected key pair(s) associated with this recovery phrase. Do you wish to continue?';
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
  isSelectAll.value = false;
  deleteAll.value = false;
  deleteSingleLocal.value = [keyId];
  isDeleteModalShown.value = true;
};

const handleMissingKeyDeleteModal = (id: number) => {
  isSelectAll.value = false;
  deleteAll.value = false;
  deleteSingleMissing.value = [id];
  isDeleteModalShown.value = true;
};

const deleteOrganization = async (organizationKeyIdToDelete: number | null) => {
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

const handleDelete = async () => {
  const activeLocalArray =
    deleteSingleLocal.value.length > 0 ? deleteSingleLocal : selectedKeyPairIdsToDelete;
  const activeMissingArray =
    deleteSingleMissing.value.length > 0 ? deleteSingleMissing : selectedMissingKeyPairIdsToDelete;
  try {
    isDeletingKey.value = true;

    if (activeLocalArray.value.length > 0) {
      for (const keyPairId of activeLocalArray.value) {
        try {
          const organizationKeyToDelete = getUserKeyToDelete(keyPairId);
          await deleteKeyPair(keyPairId);
          await deleteOrganization(organizationKeyToDelete?.id || null);
        } catch (error: unknown) {
          toast.error(getErrorMessage(error, 'Unable to delete one or more key pair(s)'));
        }
      }
    }

    if (activeMissingArray.value.length > 0) {
      for (const keyPairId of activeMissingArray.value) {
        await deleteOrganization(keyPairId);
      }
    }

    toast.success('Private key(s) deleted successfully', { position: 'bottom-right' });

    await user.refetchUserState();
    await user.refetchKeys();
    user.refetchAccounts();

    if (user.shouldSetupAccount) {
      router.push({ name: 'accountSetup' });
    }
  } catch (err: unknown) {
    toast.error(getErrorMessage(err, 'Failed to delete key pair'));
  } finally {
    selectedKeyPairIdsToDelete.value = [];
    selectedMissingKeyPairIdsToDelete.value = [];
    isDeletingKey.value = false;
    isDeleteModalShown.value = false;
    deleteAll.value = false;
    isSelectAll.value = false;
    deleteSingleLocal.value = [];
    deleteSingleMissing.value = [];
  }
};

const handleSelectMany = () => {
  isSelectAll.value = !isSelectAll.value;
  const allListedKeyPairIds = listedKeyPairs.value.map(key => key.id);
  const allListedMissingKeyPairIds = listedMissingKeyPairs.value.map(key => key.id);
  if (isSelectAll.value) {
    selectedKeyPairIdsToDelete.value = allListedKeyPairIds;
    selectedMissingKeyPairIdsToDelete.value = allListedMissingKeyPairIds;
  } else {
    selectedKeyPairIdsToDelete.value = [];
    selectedMissingKeyPairIdsToDelete.value = [];
  }
};

const handleCheckBox = (keyPairId: string | number) => {
  const arrayToChange =
    typeof keyPairId === 'number' ? selectedMissingKeyPairIdsToDelete : selectedKeyPairIdsToDelete;

  // @ts-ignore: TypeScript cannot infer the type relationship here
  arrayToChange.value = arrayToChange.value.includes(keyPairId)
    ? arrayToChange.value.filter(id => id !== keyPairId)
    : [...arrayToChange.value, keyPairId];

  isSelectAll.value = checkAllKeysSelected();
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
  if (isSelectAll.value) {
    deleteAll.value = true;
  } else {
    deleteAll.value = false;
  }
  isDeleteModalShown.value = true;
};

const handleCloseModal = () => {
  deleteSingleLocal.value = [];
  deleteSingleMissing.value = [];
  isDeleteModalShown.value = false;
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

const isCheckBoxDisabled = () => {
  const allPrivateKeys = user.keyPairs.filter(item => item.secret_hash === null);
  if (currentTab.value === Tabs.ALL) {
    if (listedKeyPairs.value.length === 0 && listedMissingKeyPairs.value.length === 0) {
      return true;
    }
    return false;
  } else if (currentTab.value === Tabs.PRIVATE_KEY) {
    if (allPrivateKeys.length === 0) {
      return true;
    } else {
      return false;
    }
  }
};

/* Watchers */
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
  isSelectAll.value = false;
  selectMany.value = false;
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
        </div>
      </div>
    </div>

    <div class="fill-remaining overflow-x-auto pe-4 pb-2 mt-4">
      <table class="table-custom">
        <thead>
          <tr>
            <th>
              <AppCheckBox
                :checked="isSelectAll"
                @update:checked="handleSelectMany"
                name="select-card"
                :data-testid="'checkbox-select-all-keys'"
                class="cursor-pointer keys-tab"
                :disabled="isCheckBoxDisabled()"
              />
            </th>
            <th class="w-10 text-center">Index</th>
            <th>Nickname</th>
            <th>Account ID</th>
            <th>Key Type</th>
            <th>Public Key</th>
            <th>Private Key</th>
            <th class="text-center">
              <AppButton
                size="small"
                color="danger"
                :data-testid="`button-delete-key-all`"
                @click="handleRemoveClick"
                class="min-w-unset"
                :class="
                  selectedKeyPairIdsToDelete.length > 0 ||
                  selectedMissingKeyPairIdsToDelete.length > 0
                    ? null
                    : 'invisible'
                "
                ><span class="bi bi-trash"></span
              ></AppButton>
            </th>
          </tr>
        </thead>
        <tbody class="text-secondary">
          <template v-for="(keyPair, index) in listedKeyPairs" :key="keyPair.public_key">
            <tr>
              <td>
                <AppCheckBox
                  :checked="selectedKeyPairIdsToDelete.includes(keyPair.id) || isSelectAll"
                  @update:checked="handleCheckBox(keyPair.id)"
                  name="select-card"
                  :data-testid="'checkbox-multiple-keys-id-' + index"
                  class="cursor-pointer d-flex justify-content-center"
                />
              </td>
              <td :data-testid="`cell-index-${index}`" class="text-center">
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
                  :class="
                    selectedKeyPairIdsToDelete.length === 0 &&
                    selectedMissingKeyPairIdsToDelete.length === 0
                      ? null
                      : 'invisible'
                  "
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
                    :checked="selectedMissingKeyPairIdsToDelete.includes(keyPair.id) || isSelectAll"
                    @update:checked="handleCheckBox(keyPair.id)"
                    name="select-card"
                    :data-testid="'checkbox-multiple-keys-id-' + index"
                    class="cursor-pointer d-flex justify-content-center"
                  />
                </td>
                <td :data-testid="`cell-index-missing-${index}`" class="text-end">
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
                    :class="
                      selectedKeyPairIdsToDelete.length === 0 &&
                      selectedMissingKeyPairIdsToDelete.length === 0
                        ? null
                        : 'invisible'
                    "
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
            <i class="bi bi-x-lg cursor-pointer" @click="handleCloseModal"></i>
          </div>
          <div class="text-center">
            <AppCustomIcon :name="'bin'" style="height: 160px" />
          </div>
          <form @submit.prevent="handleDelete">
            <h3 class="text-center text-title text-bold mt-3">
              Delete key
              {{
                selectedKeyPairIdsToDelete.length + selectedMissingKeyPairIdsToDelete.length > 1
                  ? 'pairs'
                  : 'pair'
              }}
            </h3>
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
