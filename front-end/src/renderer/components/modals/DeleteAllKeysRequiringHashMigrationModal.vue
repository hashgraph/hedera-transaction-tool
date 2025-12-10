<script setup lang="ts">
import { ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import useRecoveryPhraseHashMigrate from '@renderer/composables/useRecoveryPhraseHashMigrate';

import { deleteKey } from '@renderer/services/organization';
import { deleteKeyPair } from '@renderer/services/keyPairService';

import { isLoggedInOrganization } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Props */
defineProps<{ show: boolean }>();

/* Emits */
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'keys:deleted'): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const { getRequiredKeysToMigrate } = useRecoveryPhraseHashMigrate();

/* State */
const loadingText = ref<string | null>(null);

/* Handlers */
const handleDelete = async () => {
  const localKeyPairs = await getRequiredKeysToMigrate();

  try {
    loadingText.value = 'Deleting key pairs...';

    for (const localKeyPair of localKeyPairs) {
      if (isLoggedInOrganization(user.selectedOrganization)) {
        const organizationKeyPair = user.selectedOrganization.userKeys.find(
          key => key.publicKey === localKeyPair.public_key,
        );

        if (organizationKeyPair) {
          await deleteKey(
            user.selectedOrganization.serverUrl,
            user.selectedOrganization.userId,
            organizationKeyPair.id,
          );
        }
      }

      await deleteKeyPair(localKeyPair.id);
    }

    toast.success('Key pairs has been deleted', successToastOptions);

    emit('update:show', false);
    emit('keys:deleted');
  } finally {
    loadingText.value = null;
  }
};
</script>
<template>
  <AppModal
    v-if="show"
    :show="show"
    @update:show="emit('update:show', $event)"
    class="common-modal"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="emit('update:show', false)"></i>
      </div>
      <div class="text-center">
        <AppCustomIcon :name="'bin'" style="height: 160px" />
      </div>
      <form @submit.prevent="handleDelete">
        <h3 class="text-center text-title text-bold mt-3">Delete key pairs</h3>
        <p class="text-center mt-4">
          You are about to delete all key pairs associated with the recovery phrase you have used to
          set up the Transaction Tool. If you choose to proceed, you will have to go through
          creating or importing a recovery phrase again. Do you wish to continue?
        </p>
        <div class="d-grid mt-5">
          <AppButton
            type="submit"
            data-testid="button-delete-keypair"
            color="danger"
            :loading="Boolean(loadingText)"
            :loading-text="loadingText || ''"
            >Delete</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
