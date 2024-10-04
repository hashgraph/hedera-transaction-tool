<script setup lang="ts">
import type { MigrateUserDataResult } from '@main/shared/interfaces/migration';

import { Hbar } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import SummaryItem from './SummaryItem.vue';

/* Props */
defineProps<{
  importedKeysCount: number;
  importedUserData: MigrateUserDataResult | null;
}>();

/* Stores */
const user = useUserStore();

/* Composablse */
const router = useRouter();

/* Handlers */
const handleFinishMigration = () => {
  user.setMigrating(false);
  router.push({ name: 'settingsKeys' });
};
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
        label="Imported Keys"
        :value="importedKeysCount.toString()"
        data-testid="p-migration-summary-imported-keys"
      />

      <SummaryItem
        v-if="importedUserData?.accountsImported"
        class="mt-4"
        label="Imported Accounts"
        :value="importedUserData.accountsImported.toString()"
        data-testid="p-migration-summary-imported-accounts"
      />

      <SummaryItem
        v-if="importedUserData?.defaultMaxTransactionFee !== undefined"
        class="mt-4"
        label="Imported Default Max Transaction Fee"
        :value="Hbar.fromTinybars(importedUserData.defaultMaxTransactionFee).toString()"
        data-testid="p-migration-summary-imported-accounts"
      />

      <SummaryItem class="mt-4" label="Recovery Phrase" value="">
        <ul class="d-flex flex-wrap gap-2">
          <template v-for="word in user.recoveryPhrase?.words || []" :key="word">
            <li class="text-small text-body rounded badge-bg px-2 py-1">{{ word }}</li>
          </template>
        </ul>
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
