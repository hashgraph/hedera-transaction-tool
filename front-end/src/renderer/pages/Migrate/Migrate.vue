<script setup lang="ts">
import type { MigrateUserDataResult } from '@main/shared/interfaces/migration';
import type { RecoveryPhrase } from '@renderer/types';
import type { PersonalUser } from './components/SetupPersonal.vue';

import { computed, onMounted, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import useSetDynamicLayout from '@renderer/composables/useSetDynamicLayout';

import { resetDataLocal } from '@renderer/services/userService';
import { getStaticUser } from '@renderer/services/safeStorageService';

import DecryptRecoveryPhrase from './components/DecryptRecoveryPhrase.vue';
import SetupPersonal from './components/SetupPersonal.vue';
import SetupOrganization from './components/SetupOrganization.vue';
import ImportAccounts from './components/ImportAccounts.vue';
import BeginKeysImport from './components/BeginKeysImport.vue';
import Summary from './components/Summary.vue';

/* Types */
type StepName = 'recoveryPhrase' | 'personal' | 'organization' | 'summary';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
useSetDynamicLayout({
  loggedInClass: false,
  shouldSetupAccountClass: false,
  showMenu: false,
});

/* State */
const step = ref<StepName>('recoveryPhrase');

const recoveryPhrase = ref<RecoveryPhrase | null>(null);
const personalUser = ref<PersonalUser | null>(null);
const organizationId = ref<string | null>(null);

const userInitialized = ref(false);
const keysImported = ref(0);
const importedUserData = ref<MigrateUserDataResult | null>(null);

/* Computed */
const heading = computed(() => {
  switch (step.value) {
    case 'recoveryPhrase':
      return 'Decrypt Recovery Phrase';
    case 'personal':
      return 'Personal Information';
    case 'organization':
      return 'Organization Information';
    case 'summary':
      return 'Summary';
    default:
      return 'Migration';
  }
});

/* Handlers */
const handleSetRecoveryPhrase = async (value: RecoveryPhrase) => {
  recoveryPhrase.value = value;
  step.value = 'personal';
};

const handleSetPersonalUser = async (value: PersonalUser) => {
  personalUser.value = value;
  step.value = 'organization';
};

const handleSetOrganizationId = async (value: string) => {
  organizationId.value = value;
  await initializeUserStore();
  userInitialized.value = true;
};

const handleKeysImported = async (value: number) => {
  keysImported.value = value;
  step.value = 'summary';
};

/* Functions */
const stepIs = (name: StepName) => step.value === name;

const initializeUserStore = async () => {
  if (!recoveryPhrase.value) throw new Error('(BUG) Recovery Phrase not set');
  if (!personalUser.value) throw new Error('(BUG) Personal User not set');

  if (personalUser.value.useKeychain) {
    const staticUser = await getStaticUser();
    await user.login(staticUser.id, staticUser.email, true);
  } else {
    await user.login(personalUser.value.personalId, personalUser.value.email, false);
  }

  await user.selectOrganization(user.organizations[0]);
  await user.setRecoveryPhrase(recoveryPhrase.value.words);
  personalUser.value.password && user.setPassword(personalUser.value.password);
  await network.setup();
};

/* Hooks */
onMounted(async () => {
  await resetDataLocal();
  user.setMigrating(true);
});
</script>
<template>
  <div class="flex-column flex-centered flex-1 overflow-hidden p-6">
    <div class="container-dark-border bg-modal-surface glow-dark-bg p-5">
      <h4 class="text-title text-semi-bold text-center">{{ heading }}</h4>

      <div class="fill-remaining mt-4">
        <!-- Decrypt Recovery Phrase Step -->
        <template v-if="stepIs('recoveryPhrase')">
          <DecryptRecoveryPhrase @set-recovery-phrase="handleSetRecoveryPhrase" />
        </template>

        <!-- Setup Personal User Step -->
        <template v-if="stepIs('personal') && recoveryPhrase">
          <SetupPersonal
            :recovery-phrase="recoveryPhrase"
            @set-personal-user="handleSetPersonalUser"
          />
        </template>

        <!-- Setup Organization Step -->
        <template v-if="stepIs('organization') && recoveryPhrase && personalUser">
          <SetupOrganization
            :recovery-phrase="recoveryPhrase"
            :personal-user="personalUser"
            @set-organization-id="handleSetOrganizationId"
          />

          <template v-if="userInitialized">
            <ImportAccounts @importedUserData="importedUserData = $event" />
            <BeginKeysImport
              :recovery-phrase="recoveryPhrase"
              @keys-imported="handleKeysImported"
            />
          </template>
        </template>

        <!-- Summary Step -->
        <template v-if="stepIs('summary')">
          <Summary :imported-keys-count="keysImported" :imported-user-data="importedUserData" />
        </template>
      </div>
    </div>
  </div>
</template>
