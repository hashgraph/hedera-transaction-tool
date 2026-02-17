<script setup lang="ts">
import { Tabs } from '..';

import { computed, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useAccountSetupStore from '@renderer/stores/storeAccountSetup';

import { useToast } from 'vue-toast-notification';

import { deleteKey } from '@renderer/services/organization';
import { deleteKeyPair } from '@renderer/services/keyPairService';

import { getErrorMessage, isLoggedInOrganization, safeAwait } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Props */
const props = defineProps<{
  show: boolean;
  selectedTab: Tabs;
  allSelected: boolean;
  selectedIds: string[];
  selectedMissingIds: number[];
  selectedSingleId: string | null;
  selectedSingleMissingId: number | null;
}>();

/* Emits */
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'update:selectedIds', value: string[]): void;
  (e: 'update:selectedMissingIds', value: number[]): void;
  (e: 'update:selectedSingleId', value: string | null): void;
  (e: 'update:selectedSingleMissingId', value: number | null): void;
}>();

/* Stores */
const user = useUserStore();
const accountSetupStore = useAccountSetupStore();

/* Composables */
const toast = useToast();

/* State */
const isDeletingKey = ref(false);

/* Computed */
const modalMessage = computed(() => {
  const recoveryPhraseKeyIds = user.keyPairs
    .filter(item => item.secret_hash != null)
    .map(item => item.id);

  const privateKeyIds = user.keyPairs.filter(item => item.secret_hash == null).map(item => item.id);

  const allRecoveryPhraseKeyPairsSelected =
    recoveryPhraseKeyIds.length > 0 &&
    recoveryPhraseKeyIds.every(
      id => props.selectedIds.includes(id) || props.selectedSingleId === id,
    );

  const allPrivateKeyPairsSelected =
    privateKeyIds.length > 0 &&
    privateKeyIds.every(id => props.selectedIds.includes(id) || props.selectedSingleId === id);

  if (props.allSelected && props.selectedTab === Tabs.ALL) {
    return 'You are about to delete all key pairs. If you choose to proceed, you will have to go through creating or importing a recovery phrase again. Do you wish to continue?';
  }

  if (allRecoveryPhraseKeyPairsSelected) {
    return 'You are about to delete all key pairs associated with recovery phrase. If you choose to proceed, you will have to go through creating or importing a recovery phrase again. Do you wish to continue?';
  }

  if (allPrivateKeyPairsSelected) {
    return 'You are about to delete all key pairs imported from private keys. Do you wish to continue?';
  }

  if (props.selectedTab === Tabs.PRIVATE_KEY) {
    return 'You are about do delete the selected key pair(s) imported from a private key. Do you wish to continue?';
  }

  if (props.selectedTab === Tabs.RECOVERY_PHRASE) {
    return 'You are about to delete the selected key pair(s) associated with this recovery phrase. Do you wish to continue?';
  }

  return 'You are about to delete the selected key pair(s). Do you wish to continue?';
});

/* Handlers */
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
  const activeLocalArray = props.selectedSingleId ? [props.selectedSingleId] : props.selectedIds;
  const activeMissingArray = props.selectedSingleMissingId
    ? [props.selectedSingleMissingId]
    : props.selectedMissingIds;
  try {
    isDeletingKey.value = true;

    if (activeLocalArray.length > 0) {
      for (const keyPairId of activeLocalArray) {
        try {
          const organizationKeyToDelete = getUserKeyToDelete(keyPairId);
          await deleteKeyPair(keyPairId);
          await deleteOrganization(organizationKeyToDelete?.id || null);
        } catch (error) {
          toast.error(
            getErrorMessage(error, 'Unable to delete one or more key pair(s)'),
            errorToastOptions,
          );
        }
      }
    }

    if (activeMissingArray.length > 0) {
      for (const keyPairId of activeMissingArray) {
        await deleteOrganization(keyPairId);
      }
    }

    toast.success('Private key(s) deleted successfully', successToastOptions);

    await user.refetchUserState();
    await user.refetchKeys();
    await user.refetchAccounts();

    if (await accountSetupStore.shouldShowAccountSetup()) {
      // User has deleted all key pairs
      // => we don't want user to be display Account Setup during next navigation
      // => we simulate Skip immediately
      await accountSetupStore.handleSkipRecoveryPhrase();
    }

  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to delete key pair'), errorToastOptions);
  } finally {
    resetSelection();
    isDeletingKey.value = false;
    emit('update:show', false);
  }
};

const handleCloseModal = () => {
  emit('update:show', false);
};

/* Functions */
function resetSelection() {
  emit('update:selectedIds', []);
  emit('update:selectedMissingIds', []);
  emit('update:selectedSingleId', null);
  emit('update:selectedSingleMissingId', null);
}

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
</script>
<template>
  <AppModal :show="show" @update:show="$emit('update:show', $event)" class="common-modal">
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
          {{ selectedIds.length + selectedMissingIds.length > 1 ? 'pairs' : 'pair' }}
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
</template>
