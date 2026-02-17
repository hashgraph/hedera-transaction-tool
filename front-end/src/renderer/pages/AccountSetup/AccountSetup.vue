<script setup lang="ts">
import type { KeyPair } from '@prisma/client';

import { computed, onBeforeMount, ref } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

import useSetDynamicLayout, {
  ACCOUNT_SETUP_LAYOUT,
} from '@renderer/composables/useSetDynamicLayout';

import { isLoggedInOrganization } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppStepper from '@renderer/components/ui/AppStepper.vue';

import GenerateOrImport from './components/GenerateOrImport.vue';
import KeyPairs from './components/KeyPairs.vue';
import NewPassword from './components/NewPassword.vue';
import useVersionCheck from '@renderer/composables/useVersionCheck';
import useAccountSetupStore from '@renderer/stores/storeAccountSetup.ts';

/* Types */
type StepName = 'newPassword' | 'recoveryPhrase' | 'keyPairs';

/* Stores */
const user = useUserStore();
const accountSetupStore = useAccountSetupStore();

/* Composables */
const router = useRouter();
useSetDynamicLayout(ACCOUNT_SETUP_LAYOUT);
const { isDismissed } = useVersionCheck();

/* State */
const activeSteps = ref<StepName[]>([]);
const currentStep = ref<StepName | null>(null);
const keyPairsComponent = ref<InstanceType<typeof KeyPairs> | null>(null);
const selectedPersonalKeyPair = ref<KeyPair | null>(null);
const nextLoadingText = ref<string | null>(null);

/* Computed */
const currentStepIndex = computed(() =>
  currentStep.value !== null ? activeSteps.value.indexOf(currentStep.value) : -1,
);
const previousStep = computed(() => {
  const i = currentStepIndex.value;
  return i !== -1 && i > 0 ? activeSteps.value[i - 1] : null;
});
const nextStep = computed(() => {
  const i = currentStepIndex.value;
  return i !== -1 && i + 1 < activeSteps.value.length ? activeSteps.value[i + 1] : null;
});
const stepperItems = computed(() => {
  const result: { title: string; name: StepName }[] = [];
  if (activeSteps.value.includes('newPassword')) {
    result.push({ title: 'New Password', name: 'newPassword' });
  }
  if (activeSteps.value.includes('recoveryPhrase')) {
    result.push({ title: 'Recovery Phrase', name: 'recoveryPhrase' });
    result.push({ title: 'Key Pairs', name: 'keyPairs' });
  }
  return result;
});

/* Handlers */
const handleBack = () => {
  currentStep.value = previousStep.value;
};

const handleNext = async () => {
  if (nextStep.value !== null) {
    currentStep.value = nextStep.value;
  } else {
    try {
      nextLoadingText.value = 'Saving...';
      await keyPairsComponent.value?.handleSave();
    } finally {
      nextLoadingText.value = null;
      user.setAccountSetupStarted(false);
      await router.push({ name: 'transactions' });
    }
  }
};

/* Hooks */
onBeforeMount(async () => {
  // Collects steps to be activated
  activeSteps.value = [];
  if (await accountSetupStore.passwordChangeRequired()) {
    activeSteps.value.push('newPassword');
  }
  if (await accountSetupStore.recoveryPhraseRequired()) {
    activeSteps.value.push('recoveryPhrase');
    activeSteps.value.push('keyPairs');
  }
  // Initializes current step
  currentStep.value = activeSteps.value.length > 0 ? activeSteps.value[0] : null;
});

/* Guards */
onBeforeRouteLeave(async () => {
  try {
    await user.refetchUserState();
  } catch {
    await user.selectOrganization(null);
  }

  // Reset the version check dismissal state
  isDismissed.value = false;

  return true;
});
</script>
<template>
  <div class="flex-column-100 my-0 mx-auto p-7">
    <div
      class="container-dark-border flex-column-100 col-12 col-lg-10 col-xl-8 col-xxl-6 bg-modal-surface rounded-4 position-relative p-5 mx-auto"
    >
      <template v-if="currentStep !== null">
        <div class="w-100 flex-centered flex-column gap-4">
          <h1 data-testid="title-account-setup" class="mt-3 text-title text-bold text-center">
            Account Setup
          </h1>
          <div>
            <p
              data-testid="text-set-recovery-phrase"
              class="text-main text-secondary text-center mt-3"
            >
              {{
                isLoggedInOrganization(user.selectedOrganization) &&
                user.selectedOrganization.secretHashes.length > 0
                  ? 'Enter your Recovery Phrase to restore your Key Pairs'
                  : 'Set your Recovery Phrase and Key Pairs'
              }}
            </p>
          </div>

          <div class="mt-5 w-100">
            <AppStepper
              :items="stepperItems"
              :active-index="stepperItems.findIndex(s => s.name === currentStep)"
            >
            </AppStepper>
          </div>
        </div>
      </template>

      <Transition name="fade" mode="out-in">
        <!-- Step 1 -->
        <template v-if="currentStep === 'newPassword'">
          <NewPassword :handle-continue="handleNext" />
        </template>

        <!-- Step 2 -->
        <template v-else-if="currentStep === 'recoveryPhrase'">
          <GenerateOrImport
            v-model:selectedPersonalKeyPair="selectedPersonalKeyPair"
            :handle-next="handleNext"
          />
        </template>

        <!--Step 3 -->
        <template v-else-if="currentStep === 'keyPairs'">
          <KeyPairs
            ref="keyPairsComponent"
            v-model:step="currentStep"
            :selected-personal-key-pair="selectedPersonalKeyPair"
            @restore:start="nextLoadingText = 'Restoring key pairs...'"
            @restore:end="nextLoadingText = null"
          />
        </template>
      </Transition>

      <div class="d-flex justify-content-between">
        <div class="d-flex">
          <AppButton
            v-if="currentStep === 'keyPairs'"
            color="borderless"
            class="flex-centered mt-6"
            @click="handleBack"
            data-testid="button-back"
          >
            <i class="bi bi-arrow-left-short text-main"></i> Back</AppButton
          >
        </div>
        <AppButton
          v-if="
            (user.recoveryPhrase && currentStep !== 'recoveryPhrase') ||
            (isLoggedInOrganization(user.selectedOrganization) && selectedPersonalKeyPair !== null)
          "
          color="primary"
          @click="handleNext"
          class="ms-3 mt-6"
          data-testid="button-next"
          :disabled="Boolean(nextLoadingText)"
          :loading="Boolean(nextLoadingText)"
          :loading-text="nextLoadingText || ''"
          >Next</AppButton
        >
      </div>
    </div>
  </div>
</template>
