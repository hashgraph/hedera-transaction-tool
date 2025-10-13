<script setup lang="ts">
import type { MigrateUserDataResult } from '@shared/interfaces/migration';

import { Hbar } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import SummaryItem from './SummaryItem.vue';
import { onBeforeUnmount, onMounted, ref } from 'vue';

/* Props */
defineProps<{
  importedKeysCount: number;
  importedUserData: MigrateUserDataResult | null;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const toast = useToast();

/* State */
const recoveryPhraseItemRef = ref<HTMLElement | null>(null);

/* Handlers */
const handleFinishMigration = () => {
  router.push({ name: 'settingsKeys' });
};

const handleCopy = (event: ClipboardEvent) => {
  const selection = window.getSelection();
  if (!selection) return;

  const selectedText = selection.toString();

  if (recoveryPhraseItemRef.value instanceof HTMLElement && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    console.log('range', range);
    if (recoveryPhraseItemRef.value.contains(range.commonAncestorContainer)) {
      const strippedText = selectedText.replace(/\d+\.\s*/g, ', ');
      event.clipboardData?.setData('text/plain', strippedText);
      event.preventDefault();
      toast.success('Selected text copied to clipboard');
    }
  }
};

/* Functions */
const copyRecoveryPhrase = () => {
  const recoveryPhrase = user.recoveryPhrase?.words.join(', ') || '';
  navigator.clipboard.writeText(recoveryPhrase).then(() => {
    toast.success('Recovery phrase copied to clipboard');
  });
};

/* Hooks */
onMounted(() => {
  document.addEventListener('copy', handleCopy);
  // whether the user 'finishes' or not, they have finished account setup.
  user.setAccountSetupStarted(false);
});

onBeforeUnmount(() => {
  document.removeEventListener('copy', handleCopy);
});
</script>
<template>
  <div class="flex-column-100">
    <div class="fill-remaining overflow-x-hidden">
      <SummaryItem
        label="Organization Nickname"
        :value="user.selectedOrganization?.nickname || 'None'"
        data-testid="p-migration-summary-organization-nickname"
      />

      <SummaryItem
        class="mt-4"
        label="Organization URL"
        :value="user.selectedOrganization?.serverUrl || 'None'"
        data-testid="p-migration-summary-organization-url"
      />

      <SummaryItem
        class="mt-4"
        label="Organization Email"
        :value="
          isLoggedInOrganization(user.selectedOrganization)
            ? user.selectedOrganization.email
            : 'None'
        "
        data-testid="p-migration-summary-organization-email"
      />

      <SummaryItem
        class="mt-4"
        label="Using Keychain"
        :value="isUserLoggedIn(user.personal) && user.personal.useKeychain ? 'Yes' : 'No'"
        data-testid="p-migration-summary-use-keychain"
      />

      <SummaryItem
        class="mt-4"
        label="Imported Key Pairs"
        :value="importedKeysCount.toString()"
        data-testid="p-migration-summary-imported-keys"
      />

      <template v-if="importedUserData && importedUserData.publicKeysImported > 0">
        <SummaryItem
          class="mt-4"
          label="Imported Public Keys"
          :value="importedUserData.publicKeysImported.toString()"
          data-testid="p-migration-summary-imported-personal-id"
        />
      </template>

      <SummaryItem
        v-if="importedUserData && importedUserData.accountsImported"
        class="mt-4"
        label="Imported Accounts"
        :value="importedUserData.accountsImported.toString()"
        data-testid="p-migration-summary-imported-accounts"
      />

      <SummaryItem
        v-if="importedUserData && importedUserData.defaultMaxTransactionFee !== null"
        class="mt-4"
        label="Imported Default Max Transaction Fee"
        :value="Hbar.fromTinybars(importedUserData.defaultMaxTransactionFee).toString()"
        data-testid="p-migration-summary-imported-accounts"
      />

      <SummaryItem
        v-if="importedUserData && importedUserData.currentNetwork"
        class="mt-4"
        label="Imported Network"
        :value="importedUserData.currentNetwork"
        data-testid="p-migration-summary-network"
      />

      <SummaryItem
        v-if="user.recoveryPhrase && user.recoveryPhrase?.words.length > 0"
        class="mt-4"
        label="Recovery Phrase"
        value=""
        ref="recoveryPhraseItemRef"
      >
        <div class="position-relative">
          <AppButton
            color="primary"
            class="min-w-unset position-absolute top-0 end-0 m-2 py-1 px-3"
            @click="copyRecoveryPhrase"
          >
            <i class="bi bi-files"></i>
          </AppButton>
          <div class="container p-4 border rounded">
            <div class="row row-cols-4 g-2">
              <template v-for="(word, index) in user.recoveryPhrase?.words || []" :key="word">
                <div class="col p-1 user-select-none">
                  <span class="me-2">{{ index + 1 }}.</span>
                  <span>{{ word }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </SummaryItem>
    </div>

    <!-- Submit -->
    <div class="d-flex justify-content-end align-items-end mt-5">
      <div>
        <AppButton
          color="primary"
          type="button"
          class="w-100"
          @click="handleFinishMigration"
          data-testid="button-finish-migration"
          >Finish</AppButton
        >
      </div>
    </div>
  </div>
</template>
