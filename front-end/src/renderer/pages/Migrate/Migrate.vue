<script setup lang="ts">
import type { RecoveryPhrase } from '@renderer/types';

import { onMounted, ref } from 'vue';

import useSetDynamicLayout from '@renderer/composables/useSetDynamicLayout';

import { resetDataLocal } from '@renderer/services/userService';

import DecryptRecoveryPhrase from './components/DecryptRecoveryPhrase.vue';
import SetupPersonal from './components/SetupPersonal.vue';
import SetupOrganization from './components/SetupOrganization.vue';

/* Types */
type StepName = 'recoveryPhrase' | 'personal' | 'organization';

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
const organizationId = ref<string | null>(null);

/* Handlers */
const handleSetRecoveryPhrase = async (value: RecoveryPhrase) => {
  recoveryPhrase.value = value;
  step.value = 'personal';
};

const handleSetPersonalUser = async (
  _email: string,
  _password: string | null,
  _personalId: string,
) => {
  email.value = _email;
  password.value = _password;
  personalId.value = _personalId;
  step.value = 'organization';
};

const handleSetOrganizationId = async (value: string) => {
  organizationId.value = value;
};

/* Functions */
const stepIs = (name: StepName) => step.value === name;

/* Hooks */
onMounted(async () => {
  await resetDataLocal();
});
</script>
<template>
  <div class="flex-column flex-centered flex-1 overflow-hidden p-6">
    <div
      class="container-dark-border col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5 col-xxl-4 bg-modal-surface glow-dark-bg p-5"
    >
      <h4 class="text-title text-semi-bold text-center">Migrate</h4>

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
        <template v-if="stepIs('organization') && recoveryPhrase && email && personalId">
          <SetupOrganization
            :recovery-phrase="recoveryPhrase"
            :email="email"
            :password="password"
            :personal-id="personalId"
            @set-organization-id="handleSetOrganizationId"
          />
        </template>
      </div>
    </div>
  </div>
</template>
