<script setup lang="ts">
import type { KeyPair } from '@prisma/client';

import { onBeforeMount, ref } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

import useSetDynamicLayout, {
  ACCOUNT_SETUP_LAYOUT,
} from '@renderer/composables/useSetDynamicLayout';

import { accountSetupRequiredParts, isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppStepper from '@renderer/components/ui/AppStepper.vue';

import GenerateOrImport from './components/GenerateOrImport.vue';
import KeyPairs from './components/KeyPairs.vue';
import NewPassword from './components/NewPassword.vue';
import useVersionCheck from '@renderer/composables/useVersionCheck';

/* Types */
type StepName = 'newPassword' | 'recoveryPhrase' | 'keyPairs';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
useSetDynamicLayout(ACCOUNT_SETUP_LAYOUT);
const { isDismissed } =
  useVersionCheck();

/* State */
const keyPairsComponent = ref<InstanceType<typeof KeyPairs> | null>(null);
const step = ref<{ previous: StepName; current: StepName }>({
  previous: 'newPassword',
  current: 'newPassword',
});
const stepperItems = ref<{ title: string; name: StepName }[]>([
  { title: 'New Password', name: 'newPassword' },
  { title: 'Recovery Phrase', name: 'recoveryPhrase' },
  { title: 'Key Pairs', name: 'keyPairs' },
]);
const selectedPersonalKeyPair = ref<KeyPair | null>(null);
const nextLoadingText = ref<string | null>(null);

/* Handlers */
const handleBack = () => {
  step.value.current = step.value.previous;
  const currentPrevIndex = stepperItems.value.findIndex(i => i.name === step.value.previous);
  step.value.previous =
    currentPrevIndex > 0
      ? (step.value.previous = stepperItems.value[currentPrevIndex - 1].name)
      : stepperItems.value[0].name;
};

const handleNext = async () => {
  step.value.previous = step.value.current;
  const currentIndex = stepperItems.value.findIndex(i => i.name === step.value.current);

  if (currentIndex + 1 === stepperItems.value.length) {
    try {
      nextLoadingText.value = 'Saving...';
      await keyPairsComponent.value?.handleSave();
      user.setAccountSetupStarted(false);
    } finally {
      nextLoadingText.value = null;
      await router.push({ name: 'transactions' });
    }
  } else {
    step.value.current =
      currentIndex >= 0
        ? (step.value.current = stepperItems.value[currentIndex + 1].name)
        : stepperItems.value[0].name;
  }
};

/* Hooks */
onBeforeMount(() => {
  const removeStep = (name: string) => {
    const index = stepperItems.value.findIndex(i => i.name === name);
    if (index > -1) stepperItems.value.splice(index, 1);
  };
  const setInitialStep = (stepName: StepName) => {
    step.value.previous = stepName;
    step.value.current = stepName;
  };

  if (!isLoggedInOrganization(user.selectedOrganization)) {
    setInitialStep('recoveryPhrase');
    removeStep('newPassword');
  } else {
    const requiredParts = accountSetupRequiredParts(user.selectedOrganization, user.keyPairs);
    if (requiredParts.length === 0) router.push({ name: 'transactions' });

    if (!requiredParts.includes('password')) {
      setInitialStep('recoveryPhrase');
      removeStep('newPassword');
    } else if (!requiredParts.includes('keys')) {
      setInitialStep('newPassword');
      removeStep('recoveryPhrase');
      removeStep('keyPairs');
    }

    user.recoveryPhrase = null;
  }
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

  if (isLoggedInOrganization(user.selectedOrganization) && isUserLoggedIn(user.personal)) {
    if (user.skippedSetup) {
      return true;
    }
  }

  return !(user.personal?.isLoggedIn && user.shouldSetupAccount);
});
</script>
<template>
  <div class="flex-column-100 my-0 mx-auto p-7">
    <div
      class="container-dark-border flex-column-100 col-12 col-lg-10 col-xl-8 col-xxl-6 bg-modal-surface rounded-4 position-relative p-5 mx-auto"
    >
      <template v-if="stepperItems.map(s => s.name).includes(step.current)">
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
              :active-index="stepperItems.findIndex(s => s.name === step.current)"
            >
            </AppStepper>
          </div>
        </div>
      </template>

      <Transition name="fade" mode="out-in">
        <!-- Step 1 -->
        <template v-if="step.current === 'newPassword'">
          <NewPassword :handle-continue="handleNext" />
        </template>

        <!-- Step 2 -->
        <template v-else-if="step.current === 'recoveryPhrase'">
          <GenerateOrImport
            v-model:selectedPersonalKeyPair="selectedPersonalKeyPair"
            :handle-next="handleNext"
          />
        </template>

        <!--Step 3 -->
        <template v-else-if="step.current === 'keyPairs'">
          <KeyPairs
            ref="keyPairsComponent"
            v-model:step="step"
            :selected-personal-key-pair="selectedPersonalKeyPair"
            @restore:start="nextLoadingText = 'Restoring key pairs...'"
            @restore:end="nextLoadingText = null"
          />
        </template>
      </Transition>

      <div class="d-flex justify-content-between">
        <div class="d-flex">
          <AppButton
            v-if="['keyPairs'].includes(step.current)"
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
            (user.recoveryPhrase && step.current !== 'recoveryPhrase') ||
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
