<script setup lang="ts">
import { Tabs } from '.';

import { computed, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import useKeyManager, { KeyInfo } from '@renderer/composables/useKeyManager.ts';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import UpdateNicknameModal from '@renderer/components/modals/UpdateNicknameModal.vue';
import TabHeading from './components/TabHeading.vue';
import ImportExternalPrivateKeyModal from '@renderer/components/ImportExternalPrivateKeyModal.vue';
import { KeyType } from '@renderer/types';
import KeyRow from '@renderer/pages/Settings/components/KeysTab/components/KeyRow.vue';
import DeleteKeyPairsController from '@renderer/pages/Settings/components/KeysTab/components/DeleteKeyPairsController.vue';
import ReUploadKeyPairController from '@renderer/pages/Settings/components/KeysTab/components/ReUploadKeyPairController.vue';
import { getPublicKeyAndType, isLoggedInOrganization } from '@renderer/utils';
import { RESTORE_MISSING_KEYS } from '@renderer/router';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const keyManager = useKeyManager(
  computed(() => user.keyPairs),
  computed(() =>
    isLoggedInOrganization(user.selectedOrganization) ? user.selectedOrganization.userKeys : [],
  ),
);

/* State */
const isUpdateNicknameModalShown = ref(false);
const keyPairIdToEdit = ref<string | null>(null);

const selectedTab = ref(Tabs.ALL);
const selectedRecoveryPhrase = ref<string | undefined>();
const selectedKeyInfos = ref<KeyInfo[]>([]);

const isDeleteModalShown = ref(false);
const toBeDeletedKeyInfos = ref<KeyInfo[]>([]);

const isImportExternalModalShown = ref(false);
const publicKey = ref<string>('');
const keyType = ref<KeyType>(KeyType.ED25519);

const isReUploadActionActive = ref<boolean>(false);
const toBeReUploadedKeyInfo = ref<KeyInfo | null>(null);

/* Computed */
const displayedKeyInfos = computed(() => {
  return keyManager.keyInfos.value.filter(info => isKeyInfoVisible(info));
});

const allKeysSelected = computed(
  () => displayedKeyInfos.value.length === selectedKeyInfos.value.length,
);

const isSelectAllDisabled = computed(() => displayedKeyInfos.value.length === 0);

const keyTypeString = computed(() => {
  return KeyType[keyType.value] as 'ED25519' | 'ECDSA';
});

/* Handlers */
const handleStartNicknameEdit = (keyPairId: string) => {
  keyPairIdToEdit.value = keyPairId;
  isUpdateNicknameModalShown.value = true;
};

const handleSelect = (keyInfo: KeyInfo) => {
  const keyInfoIndex = selectedKeyInfos.value.indexOf(keyInfo);
  if (keyInfoIndex != -1) {
    selectedKeyInfos.value.splice(keyInfoIndex, 1);
  } else {
    selectedKeyInfos.value.push(keyInfo);
  }
};

const handleSelectAll = () => {
  if (selectedKeyInfos.value.length === displayedKeyInfos.value.length) {
    // We deselect all
    selectedKeyInfos.value = [];
  } else {
    // We select all
    selectedKeyInfos.value = displayedKeyInfos.value.slice();
  }
};

const handleDeleteSelectedClick = () => {
  toBeDeletedKeyInfos.value = selectedKeyInfos.value.slice();
  isDeleteModalShown.value = true;
};

const handleDeleteSingle = (keyInfo: KeyInfo) => {
  toBeDeletedKeyInfos.value = [keyInfo];
  isDeleteModalShown.value = true;
};

const deleteCompleted = async () => {
  selectedKeyInfos.value = []; // => resets toBeDeletedKeyInfos
  await user.refetchUserState();
  await user.refetchKeys();
  await user.refetchAccounts();
};

const handleRestoreMissingKey = (keyInfo: KeyInfo) => {
  const userKey = keyInfo.userKey;
  if (userKey !== null) {
    if (userKey.index) {
      router.push({
        name: RESTORE_MISSING_KEYS,
        params: { index: userKey.index, publicKey: userKey.publicKey },
      });
    } else {
      keyType.value = getPublicKeyAndType(userKey.publicKey).keyType;
      publicKey.value = userKey.publicKey;
      isImportExternalModalShown.value = true;
    }
  }
};

const handleReconcile = (keyInfo: KeyInfo) => {
  toBeReUploadedKeyInfo.value = keyInfo;
  isReUploadActionActive.value = true;
};

const reUploadCompleted = async () => {
  toBeReUploadedKeyInfo.value = null;
  await user.refetchUserState();
  await user.refetchKeys();
  await user.refetchAccounts();
};

/* Functions */
const isKeyInfoVisible = (keyInfo: KeyInfo) => {
  switch (selectedTab.value) {
    case Tabs.ALL:
      return true;
    case Tabs.RECOVERY_PHRASE:
      return keyInfo.mnemonicHash() === selectedRecoveryPhrase.value;
    case Tabs.PRIVATE_KEY:
      return keyInfo.mnemonicHash() === null;
  }
};

/* Watchers */
watch([selectedTab, selectedRecoveryPhrase], () => {
  selectedKeyInfos.value = [];
});
watch(selectedKeyInfos, () => (toBeDeletedKeyInfos.value = []));
</script>
<template>
  <div class="flex-column-100">
    <div>
      <TabHeading
        v-model:selected-tab="selectedTab"
        v-model:selected-recovery-phrase="selectedRecoveryPhrase"
        :key-infos="displayedKeyInfos"
      />
    </div>

    <div class="fill-remaining overflow-x-auto pb-2 mt-4">
      <table class="table-custom">
        <thead>
          <tr>
            <th>
              <AppCheckBox
                :checked="allKeysSelected && displayedKeyInfos.length > 0"
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
              <div class="d-flex justify-content-end">
                <AppButton
                  size="small"
                  color="danger"
                  :data-testid="`button-delete-key-all`"
                  @click="handleDeleteSelectedClick"
                  class="min-w-unset"
                  :class="selectedKeyInfos.length > 0 ? null : 'invisible'"
                  ><span class="bi bi-trash"></span
                ></AppButton>
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="text-secondary">
          <template v-for="(keyInfo, index) in displayedKeyInfos" :key="keyInfo.publicKey">
            <KeyRow
              :keyInfo="keyInfo"
              :row-index="index"
              :checked="selectedKeyInfos.includes(keyInfo)"
              :enable-delete="selectedKeyInfos.length === 0"
              @update:checked="handleSelect"
              @delete="handleDeleteSingle"
              @restore="handleRestoreMissingKey"
              @reconcile="handleReconcile"
              @editNickname="handleStartNicknameEdit"
            />
          </template>
        </tbody>
      </table>

      <DeleteKeyPairsController
        v-model:activate="isDeleteModalShown"
        :key-infos="toBeDeletedKeyInfos"
        :callback="deleteCompleted"
      />

      <ReUploadKeyPairController
        v-model:activate="isReUploadActionActive"
        :key-info="toBeReUploadedKeyInfo"
        :callback="reUploadCompleted"
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
