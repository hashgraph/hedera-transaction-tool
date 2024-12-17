<script setup lang="ts">
import type { MigrateUserDataResult } from '@main/shared/interfaces/migration';
import type { RecoveryPhrase } from '@renderer/types';
import type { PersonalUser } from './components/SetupPersonal.vue';
import { decryptKeysFromFiles } from '@renderer/services/encryptedKeys';
import { computed, onMounted, ref } from 'vue';

import { MIGRATION_STARTED } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import useSetDynamicLayout, { DEFAULT_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import { useRouter } from 'vue-router';

import { resetDataLocal } from '@renderer/services/userService';
import { getStaticUser } from '@renderer/services/safeStorageService';
import { add, remove } from '@renderer/services/claimService';

import { safeAwait } from '@renderer/utils';

import DecryptRecoveryPhrase from './components/DecryptRecoveryPhrase.vue';
import SetupPersonal from './components/SetupPersonal.vue';
import SetupOrganization from './components/SetupOrganization.vue';
import ImportUserData from './components/ImportUserData.vue';
import BeginKeysImport from './components/BeginKeysImport.vue';
import Summary from './components/Summary.vue';
import SelectKeys from './components/SelectKeys.vue';
import { DecryptedKeyWithPublic } from '@main/shared/interfaces';
import { getDataMigrationKeysPath } from '@renderer/services/migrateDataService';
import { searchEncryptedKeys } from '@renderer/services/encryptedKeys';
import { PrivateKey } from '@hashgraph/sdk';

/* Types */
type StepName = 'recoveryPhrase' | 'personal' | 'organization' | 'selectKeys' | 'summary';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
useSetDynamicLayout(DEFAULT_LAYOUT);

/* State */
const step = ref<StepName>('recoveryPhrase');

const recoveryPhrase = ref<RecoveryPhrase | null>(null);
const recoveryPhrasePassword = ref<string | null>(null);
const personalUser = ref<PersonalUser | null>(null);
const organizationId = ref<string | null>(null);

const userInitialized = ref(false);
const keysImported = ref(0);
const importedUserData = ref<MigrateUserDataResult | null>(null);
const allUserKeysToRecover = ref<DecryptedKeyWithPublic[]>([]);
const selectedKeysToRecover = ref<DecryptedKeyWithPublic[]>([]);

/* Computed */
const heading = computed(() => {
  switch (step.value) {
    case 'recoveryPhrase':
      return 'Decrypt Recovery Phrase';
    case 'personal':
      return 'Personal Information';
    case 'organization':
      return 'Organization Information';
    case 'selectKeys':
      return 'Select Keys To Recover';
    case 'summary':
      return 'Summary';
    default:
      return 'Migration';
  }
});

/* Handlers */
const handleStopMigration = async () => {
  user.setMigrating(false);
  await resetDataLocal();
  user.logout();
  router.push({ name: 'login' });
};

const handleSetRecoveryPhrase = async (value: {
  recoveryPhrase: RecoveryPhrase;
  recoveryPhrasePassword: string;
}) => {
  recoveryPhrase.value = value.recoveryPhrase;
  recoveryPhrasePassword.value = value.recoveryPhrasePassword;

  const keysPath = await getDataMigrationKeysPath();
  const encryptedKeyPaths = await searchEncryptedKeys([keysPath]);
  if (recoveryPhrasePassword.value) {
    const decryptedKeys = await decryptKeysFromFiles(
      encryptedKeyPaths,
      recoveryPhrase.value.words,
      recoveryPhrasePassword.value,
    );
    const decryptedArr = decryptedKeys.map((key, index) => {
      const privateKey = PrivateKey.fromStringDer(key.privateKey);
      const formattedPublic = privateKey.publicKey.toStringRaw();
      const fileName =
        encryptedKeyPaths[index].split('/').pop()?.split('.').slice(0, -1).join('.') || '';
      const filepath = encryptedKeyPaths[index];
      return new DecryptedKeyWithPublic(fileName, formattedPublic, filepath);
    });
    allUserKeysToRecover.value = decryptedArr;
  }

  step.value = 'personal';
};

const handleSetPersonalUser = async (value: PersonalUser) => {
  personalUser.value = value;
  await toggleMigrationClaim(personalUser.value.personalId, true);
  step.value = 'organization';
};

const handleSetOrganizationId = async (value: string) => {
  organizationId.value = value;
  await initializeUserStore();
  userInitialized.value = true;
  step.value = 'selectKeys';
};

const handleKeysImported = async (value: number) => {
  if (!personalUser.value) throw new Error('(BUG) Personal User not set');
  await toggleMigrationClaim(personalUser.value.personalId, false);
  keysImported.value = value;
  step.value = 'summary';
};

const handleSelectedKeys = (keysToRecover: DecryptedKeyWithPublic[]) => {
  selectedKeysToRecover.value = keysToRecover;
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
};

const toggleMigrationClaim = async (userId: string, start = false) => {
  if (start) {
    await safeAwait(add(userId, MIGRATION_STARTED, 'true'));
  } else {
    await safeAwait(remove(userId, [MIGRATION_STARTED]));
  }
};

/* Hooks */
onMounted(async () => {
  user.setMigrating(true);
});
</script>
<template>
  <div class="flex-column flex-centered flex-1 overflow-hidden p-6">
    <div
      class="container-dark-border bg-modal-surface glow-dark-bg p-5"
      :class="step === 'selectKeys' ? 'custom-key-modal' : null"
    >
      <h4 class="text-title text-semi-bold text-center">{{ heading }}</h4>

      <div class="fill-remaining mt-4">
        <!-- Decrypt Recovery Phrase Step -->
        <template v-if="stepIs('recoveryPhrase')">
          <DecryptRecoveryPhrase
            @set-recovery-phrase="handleSetRecoveryPhrase"
            @stop-migration="handleStopMigration"
          />
        </template>

        <!-- Setup Personal User Step -->
        <template v-if="stepIs('personal') && recoveryPhrase">
          <SetupPersonal
            :recovery-phrase="recoveryPhrase"
            @set-personal-user="handleSetPersonalUser"
            @migration:cancel="handleStopMigration"
          />
        </template>

        <!-- Setup Organization Step -->
        <template
          v-if="stepIs('organization') && recoveryPhrase && recoveryPhrasePassword && personalUser"
        >
          <SetupOrganization
            :recovery-phrase="recoveryPhrase"
            :personal-user="personalUser"
            @set-organization-id="handleSetOrganizationId"
            @migration:cancel="handleStopMigration"
          />
        </template>

        <!-- Select Keys Step -->
        <template
          v-if="
            stepIs('selectKeys') &&
            recoveryPhrase &&
            recoveryPhrasePassword &&
            personalUser &&
            allUserKeysToRecover.length > 0
          "
        >
          <SelectKeys
            v-if="userInitialized"
            :keys-to-recover="allUserKeysToRecover"
            @migration:cancel="handleStopMigration"
            @selected-keys="handleSelectedKeys"
          />

          <template v-if="selectedKeysToRecover.length > 0">
            <ImportUserData @importedUserData="importedUserData = $event" />
            <BeginKeysImport
              :recovery-phrase="recoveryPhrase"
              :recovery-phrase-password="recoveryPhrasePassword"
              :selected-keys="selectedKeysToRecover"
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
