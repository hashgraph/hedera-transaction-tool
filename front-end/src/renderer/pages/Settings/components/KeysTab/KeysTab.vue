<script setup lang="ts">
import { Tabs } from '.';

import { computed, ref, watch } from 'vue';
import { PublicKey } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { CommonNetwork } from '@shared/enums';

import { decryptPrivateKey } from '@renderer/services/keyPairService';

import {
  assertUserLoggedIn,
  getAccountIdWithChecksum,
  getPublicKeyAndType,
  isLoggedInOrganization,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import UpdateNicknameModal from '@renderer/components/modals/UpdateNicknameModal.vue';
import TabHeading from './components/TabHeading.vue';
import DeleteKeyPairsModal from './components/DeleteKeyPairsModal.vue';

import { RESTORE_MISSING_KEYS } from '@renderer/router';
import ImportExternalPrivateKeyModal from '@renderer/components/ImportExternalPrivateKeyModal.vue';
import { KeyType } from '@renderer/types';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const router = useRouter();
const toast = useToast();
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const decryptedKeys = ref<{ decrypted: string | null; publicKey: string }[]>([]);
const publicKeysPrivateKeyToDecrypt = ref('');

const isUpdateNicknameModalShown = ref(false);
const keyPairIdToEdit = ref<string | null>(null);

const selectedTab = ref(Tabs.ALL);
const selectedRecoveryPhrase = ref<string>('');

const isDeleteModalShown = ref(false);
const selectedKeyPairIdsToDelete = ref<string[]>([]);
const selectedMissingKeyPairIdsToDelete = ref<number[]>([]);
const deleteSingleLocal = ref<string | null>(null);
const deleteSingleMissing = ref<number | null>(null);

const isImportExternalModalShown = ref(false);
const publicKey = ref<string>('');
const keyType = ref<KeyType>(KeyType.ED25519);

/* Computed */
const missingKeys = computed(() =>
  isLoggedInOrganization(user.selectedOrganization)
    ? user.selectedOrganization.userKeys.filter(
        key => !user.keyPairs.some(kp => kp.public_key === key.publicKey),
      )
    : [],
);

const listedKeyPairs = computed(() => {
  return user.keyPairs.filter(item => {
    switch (selectedTab.value) {
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
      selectedTab.value === Tabs.ALL ||
      (selectedTab.value === Tabs.RECOVERY_PHRASE &&
        keyPair.mnemonicHash &&
        keyPair.mnemonicHash === selectedRecoveryPhrase.value) ||
      (selectedTab.value === Tabs.PRIVATE_KEY && !keyPair.mnemonicHash)
    );
  });
});

const allKeysSelected = computed(
  () =>
    selectedKeyPairIdsToDelete.value.length === listedKeyPairs.value.length &&
    selectedMissingKeyPairIdsToDelete.value.length === listedMissingKeyPairs.value.length,
);

const isSelectAllDisabled = computed(
  () => listedKeyPairs.value.length === 0 && listedMissingKeyPairs.value.length === 0,
);

const keyTypeString = computed(() => {
  return KeyType[keyType.value] as 'ED25519' | 'ECDSA';
});

/* Handlers */
const handleStartNicknameEdit = (id: string) => {
  keyPairIdToEdit.value = id;
  isUpdateNicknameModalShown.value = true;
};

const handleShowPrivateKey = async (publicKey: string) => {
  publicKeysPrivateKeyToDecrypt.value = publicKey;
  await decrypt();
};

const handleHideDecryptedKey = (publicKey: string) => {
  const keyFromDecryptedIndex = decryptedKeys.value.findIndex(kp => kp.publicKey === publicKey);

  if (keyFromDecryptedIndex >= 0) {
    decryptedKeys.value.splice(keyFromDecryptedIndex, 1);
    decryptedKeys.value = [...decryptedKeys.value];
  }
};

const handleCopy = (text: string, message: string) => {
  navigator.clipboard.writeText(text);
  toast.success(message, successToastOptions);
};

const handleSelectAll = () => {
  const allListedKeyPairIds = listedKeyPairs.value.map(key => key.id);
  const allListedMissingKeyPairIds = listedMissingKeyPairs.value.map(key => key.id);
  if (!allKeysSelected.value) {
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
};

const handleDeleteModal = (keyId: string) => {
  deleteSingleLocal.value = keyId;
  isDeleteModalShown.value = true;
};

const handleMissingKeyDeleteModal = (id: number) => {
  deleteSingleMissing.value = id;
  isDeleteModalShown.value = true;
};

const handleDeleteSelectedClick = () => (isDeleteModalShown.value = true);

const handleRestoreMissingKey = (keyPair: { id: number; publicKey: string; index?: number }) => {
  if (keyPair.index !== undefined) {
    router.push({
      name: RESTORE_MISSING_KEYS,
      params: { index: keyPair.index, publicKey: keyPair.publicKey },
    });
  } else {
    keyType.value = getPublicKeyAndType(keyPair.publicKey).keyType;
    publicKey.value = keyPair.publicKey;
    isImportExternalModalShown.value = true;
  }
};

const handleAccountString = (publicKey: string): string | null => {
  const account = user.publicKeyToAccounts.find(acc => acc.publicKey === publicKey)?.accounts[0]
    ?.account;
  if (account) {
    return getAccountIdWithChecksum(account);
  }
  return null;
};

/* Functions */
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
    toast.error('Failed to decrypt private key', errorToastOptions);
  }
};

/* Watchers */
watch([selectedTab, selectedRecoveryPhrase], () => {
  selectedKeyPairIdsToDelete.value = [];
  selectedMissingKeyPairIdsToDelete.value = [];
});
</script>
<template>
  <div class="flex-column-100">
    <div>
      <TabHeading
        v-model:selected-tab="selectedTab"
        v-model:selected-recovery-phrase="selectedRecoveryPhrase"
        :listed-key-pairs="listedKeyPairs"
        :listed-missing-key-pairs="listedMissingKeyPairs"
      />
    </div>

    <div class="fill-remaining overflow-x-auto pe-4 pb-2 mt-4">
      <table class="table-custom">
        <thead>
          <tr>
            <th>
              <AppCheckBox
                :checked="
                  allKeysSelected && (listedKeyPairs.length > 0 || listedMissingKeyPairs.length > 0)
                "
                @update:checked="handleSelectAll"
                name="select-card"
                :data-testid="'checkbox-select-all-keys'"
                class="cursor-pointer keys-tab"
                :disabled="isSelectAllDisabled"
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
                @click="handleDeleteSelectedClick"
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
                  :checked="selectedKeyPairIdsToDelete.includes(keyPair.id)"
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
                  {{ handleAccountString(keyPair.public_key) ?? 'N/A' }}
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
                    :checked="selectedMissingKeyPairIdsToDelete.includes(keyPair.id)"
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
                    {{ handleAccountString(keyPair.publicKey) ?? 'N/A' }}</span
                  >
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
                    @click="handleRestoreMissingKey(keyPair)"
                    class="min-w-unset me-2"
                    :class="
                      selectedKeyPairIdsToDelete.length === 0 &&
                      selectedMissingKeyPairIdsToDelete.length === 0
                        ? null
                        : 'invisible'
                    "
                    ><span class="bi bi-arrow-repeat"></span
                  ></AppButton>
                  <AppButton
                    size="small"
                    color="danger"
                    :data-testid="`button-delete-key-${index}`"
                    @click="handleMissingKeyDeleteModal(keyPair.id)"
                    class="min-w-unset ms-2"
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
          </template>
        </tbody>
      </table>

      <DeleteKeyPairsModal
        v-model:show="isDeleteModalShown"
        :selected-tab="selectedTab"
        :all-selected="allKeysSelected"
        v-model:selected-ids="selectedKeyPairIdsToDelete"
        v-model:selected-missing-ids="selectedMissingKeyPairIdsToDelete"
        v-model:selected-single-id="deleteSingleLocal"
        v-model:selected-single-missing-id="deleteSingleMissing"
      />

      <UpdateNicknameModal
        v-model:show="isUpdateNicknameModalShown"
        :key-pair-id="keyPairIdToEdit || ''"
      />

      <ImportExternalPrivateKeyModal
        class="min-w-unset"
        :key-type="keyTypeString"
        :public-key="publicKey"
        v-model:show="isImportExternalModalShown"
      />
    </div>
  </div>
</template>
