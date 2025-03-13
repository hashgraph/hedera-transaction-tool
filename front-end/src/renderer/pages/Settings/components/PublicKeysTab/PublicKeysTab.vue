<script setup lang="ts">
import type { PublicKeyMapping } from '@prisma/client';
import { computed, onBeforeMount, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { getPublicKeyOwner } from '@renderer/services/organization';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import DeletePublicKeyMappingModal from './components/DeletePublicKeyMappingModal.vue';
import RenamePublicKeyModal from './components/RenamePublicKeyModal.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const isDeleteModalShown = ref(false);
const selectedPublicKeysToDelete = ref<string[]>([]);
const deleteSingle = ref<string | null>(null);
const isUpdateNicknameModalShown = ref(false);
const publicKeyMappingToEdit = ref<PublicKeyMapping | null>(null);
const ownersMapping = ref<Record<string, string | null>>({});

/* Computed */
const listedPublicKeys = computed(() => user.publicKeyMappings);
const allKeysSelected = computed(
  () => selectedPublicKeysToDelete.value.length === listedPublicKeys.value.length,
);
const isSelectAllDisabled = computed(() => listedPublicKeys.value.length === 0);

/* Handlers */
const handleStartNicknameEdit = (publicKeyMapping: PublicKeyMapping) => {
  publicKeyMappingToEdit.value = publicKeyMapping;
  isUpdateNicknameModalShown.value = true;
};

const handleCopy = (text: string, message: string) => {
  navigator.clipboard.writeText(text);
  toast.success(message);
};

const handleSelectAll = () => {
  const allListedIds = listedPublicKeys.value.map(key => key.id);
  if (!allKeysSelected.value) {
    selectedPublicKeysToDelete.value = allListedIds;
  } else {
    selectedPublicKeysToDelete.value = [];
  }
};

const handleCheckBox = (selectedId: string) => {
  selectedPublicKeysToDelete.value.includes(selectedId)
    ? (selectedPublicKeysToDelete.value = selectedPublicKeysToDelete.value.filter(
        id => id !== selectedId,
      ))
    : (selectedPublicKeysToDelete.value = [...selectedPublicKeysToDelete.value, selectedId]);
};

const handleDeleteModal = (keyId: string) => {
  deleteSingle.value = keyId;
  isDeleteModalShown.value = true;
};

const handleDeleteSelectedClick = () => (isDeleteModalShown.value = true);

/* Helper Functions */
const getOwnersFromOrganization = async () => {
  const publicKeys = user.publicKeyMappings;

  const ownerPromises = publicKeys.map(async key => {
    return { [key]: await getPublicKeyOwner(user.selectedOrganization!.serverUrl, key.publicKey) };
  });
  const results: Record<string, string | null>[] = await Promise.all(ownerPromises);

  ownersMapping.value = Object.assign({}, ...results);
};

const addOwners = async (newMappings: PublicKeyMapping[], oldMappings: PublicKeyMapping[]) => {
  const newItems = newMappings.filter(
    newItem => !oldMappings.some(oldItem => oldItem.publicKey === newItem.publicKey),
  );
  const newPublicKeys = newItems.map(mapping => mapping.publicKey);
  const ownerPromises = newPublicKeys.map(async key => {
    return { [key]: await getPublicKeyOwner(user.selectedOrganization!.serverUrl, key) };
  });
  const results: Record<string, string | null>[] = await Promise.all(ownerPromises);
  Object.assign(ownersMapping.value, ...results);
};

const deleteOwners = (newMappings: PublicKeyMapping[], oldMappings: PublicKeyMapping[]) => {
  const deletedItems = oldMappings.filter(
    oldItem => !newMappings.some(newItem => newItem.publicKey === oldItem.publicKey),
  );
  const deletedPublicKeys = deletedItems.map(mapping => mapping.publicKey);

  deletedPublicKeys.forEach(key => {
    delete ownersMapping.value[key];
  });
};

/* Watchers */
watch(
  () => user.selectedOrganization,
  async newOrg => {
    if (!newOrg) {
      ownersMapping.value = {};
      return;
    }
    await getOwnersFromOrganization();
  },
);

watch(
  () => user.publicKeyMappings,
  async (newMappings, oldMappings) => {
    if (newMappings.length === oldMappings.length || !user.selectedOrganization) {
      return;
    }

    if (newMappings.length > oldMappings.length) {
      await addOwners(newMappings, oldMappings);
    }

    if (newMappings.length < oldMappings.length) {
      deleteOwners(newMappings, oldMappings);
    }
  },
);

/* Lifecycle hooks */
onBeforeMount(async () => {
  await user.refetchPublicKeys();

  if (user.selectedOrganization) {
    await getOwnersFromOrganization();
  }
});
</script>
<template>
  <div class="flex-column-100">
    <div class="fill-remaining overflow-x-auto pe-4 pb-2 mt-4">
      <table class="table-custom">
        <thead>
          <tr>
            <th>
              <AppCheckBox
                :checked="allKeysSelected && listedPublicKeys.length > 0"
                @update:checked="handleSelectAll"
                name="select-card"
                :data-testid="'checkbox-select-all-public-keys'"
                class="cursor-pointer keys-tab"
                :disabled="isSelectAllDisabled"
              />
            </th>
            <th>Nickname</th>
            <th>Owner</th>
            <th>Public Key</th>
            <th class="text-center">
              <AppButton
                size="small"
                color="danger"
                :data-testid="`button-delete-public-all`"
                @click="handleDeleteSelectedClick"
                class="min-w-unset"
                :class="selectedPublicKeysToDelete.length > 0 ? null : 'invisible'"
                ><span class="bi bi-trash"></span
              ></AppButton>
            </th>
          </tr>
        </thead>
        <tbody class="text-secondary">
          <template v-for="(mapping, index) in listedPublicKeys" :key="mapping.publicKey">
            <tr>
              <td>
                <AppCheckBox
                  :checked="selectedPublicKeysToDelete.includes(mapping.id)"
                  @update:checked="handleCheckBox(mapping.id)"
                  name="select-card"
                  :data-testid="'checkbox-multiple-keys-id-' + index"
                  class="cursor-pointer d-flex justify-content-center"
                />
              </td>

              <td :data-testid="`cell-public-nickname-${index}`">
                <span
                  class="bi bi-pencil-square text-main text-primary me-3 cursor-pointer"
                  data-testid="button-change-key-nickname"
                  @click="handleStartNicknameEdit(mapping)"
                ></span>
                {{ mapping.nickname || 'N/A' }}
              </td>
              <td :data-testid="`cell-owner-account-${index}`">
                <span>
                  {{ ownersMapping[mapping.publicKey] || 'N/A' }}
                </span>
              </td>
              <td>
                <p class="d-flex text-nowrap">
                  <span
                    :data-testid="`span-public-key-${index}`"
                    class="d-inline-block text-truncate"
                    style="width: 12vw"
                    >{{ mapping.publicKey }}</span
                  >
                  <span
                    :data-testid="`span-copy-public-key-${index}`"
                    class="bi bi-copy cursor-pointer ms-3"
                    @click="handleCopy(mapping.publicKey, 'Public Key copied successfully')"
                  ></span>
                </p>
              </td>
              <td class="text-center">
                <AppButton
                  size="small"
                  color="danger"
                  :data-testid="`button-delete-key-${index}`"
                  @click="handleDeleteModal(mapping.id)"
                  class="min-w-unset"
                  :class="selectedPublicKeysToDelete.length === 0 ? null : 'invisible'"
                  ><span class="bi bi-trash"></span
                ></AppButton>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <template v-if="listedPublicKeys.length === 0">
        <div class="flex-centered flex-column text-center" v-bind="$attrs">
          <div>
            <span class="bi bi-key text-huge text-secondary"></span>
          </div>
          <div class="mt-3">
            <p class="text-title text-semi-bold">There are no public keys.</p>
          </div>
        </div>
      </template>

      <DeletePublicKeyMappingModal
        v-model:show="isDeleteModalShown"
        :all-selected="allKeysSelected"
        v-model:selected-ids="selectedPublicKeysToDelete"
        v-model:selected-single-id="deleteSingle"
      />
    </div>

    <RenamePublicKeyModal
      v-model:show="isUpdateNicknameModalShown"
      :public-key-mapping="publicKeyMappingToEdit"
    />
  </div>
</template>
