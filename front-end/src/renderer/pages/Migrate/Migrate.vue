<script setup lang="ts">
import type { RecoveryPhrase } from '@renderer/types';

import { computed, onMounted, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

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

/* Composables */
useSetDynamicLayout({
  loggedInClass: false,
  shouldSetupAccountClass: false,
  showMenu: false,
});

/* State */
const step = ref<StepName>('recoveryPhrase');

const recoveryPhrase = ref<RecoveryPhrase | null>(null);

const email = ref<string | null>(null);
const password = ref<string | null>(null);
const personalId = ref<string | null>(null);
const useKeychain = ref<boolean | null>(null);

const organizationId = ref<string | null>(null);

const userInitialized = ref(false);

const keysImported = ref(0);
const accountsImported = ref(0);

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

const handleSetPersonalUser = async (
  _email: string,
  _password: string | null,
  _personalId: string,
  _useKeychain: boolean,
) => {
  email.value = _email;
  password.value = _password;
  personalId.value = _personalId;
  useKeychain.value = _useKeychain;
  step.value = 'organization';
};

const handleSetOrganizationId = async (value: string) => {
  organizationId.value = value;
  await initializeUserStore();
  userInitialized.value = true;
};

const handleKeysImported = async (importedCount: number) => {
  keysImported.value = importedCount;
  step.value = 'summary';
};

/* Functions */
const stepIs = (name: StepName) => step.value === name;

const initializeUserStore = async () => {
  if (!personalId.value) throw new Error('(BUG) Personal ID not set');
  if (!email.value) throw new Error('(BUG) Email not set');
  if (!recoveryPhrase.value) throw new Error('(BUG) Recovery Phrase not set');

  if (useKeychain.value) {
    const staticUser = await getStaticUser();
    await user.login(staticUser.id, staticUser.email, true);
  } else {
    await user.login(personalId.value, email.value, false);
  }

  await user.selectOrganization(user.organizations[0]);
  await user.setRecoveryPhrase(recoveryPhrase.value.words);
  password.value && user.setPassword(password.value);
};

/* Hooks */
onMounted(async () => {
  await resetDataLocal();
  user.setMigrating(true);
});
</script>
<template>
  <div class="flex-column flex-centered flex-1 overflow-hidden p-6">
    <div
      class="container-dark-border col-12 col-sm-10 col-md-8 col-lg-7 col-xl-6 col-xxl-4 bg-modal-surface glow-dark-bg p-5"
    >
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
        <template
          v-if="
            stepIs('organization') && recoveryPhrase && email && personalId && useKeychain !== null
          "
        >
          <SetupOrganization
            :recovery-phrase="recoveryPhrase"
            :email="email"
            :password="password"
            :personal-id="personalId"
            :use-keychain="useKeychain"
            @set-organization-id="handleSetOrganizationId"
          />

          <template v-if="userInitialized">
            <ImportAccounts @imported-accounts="accountsImported = $event" />
            <BeginKeysImport
              :recovery-phrase="recoveryPhrase"
              @keys-imported="handleKeysImported"
            />
          </template>
        </template>

        <!-- Summary Step -->
        <template v-if="stepIs('summary')">
          <Summary
            :imported-keys-count="keysImported"
            :imported-accounts-count="accountsImported"
          />
        </template>
      </div>
    </div>
  </div>
</template>
