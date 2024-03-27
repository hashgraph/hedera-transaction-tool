<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppStepper from '@renderer/components/ui/AppStepper.vue';

import GenerateOrImport from './components/GenerateOrImport.vue';
import KeyPairs from './components/KeyPairs.vue';
import NewPassword from './components/NewPassword.vue';

/* Stores */
const user = useUserStore();
const keyPairs = useKeyPairsStore();

/* State */
const keyPairsComponent = ref<typeof KeyPairs | null>(null);
const step = ref({ previous: 'newPassword', current: 'newPassword' });
const stepperItems = ref([
  { title: 'New Password', name: 'newPassword' },
  { title: 'Recovery Phrase', name: 'recoveryPhrase' },
  { title: 'Key Pairs', name: 'keyPairs' },
]);

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
    await keyPairsComponent.value?.handleSaveKey();
  } else {
    step.value.current =
      currentIndex >= 0
        ? (step.value.current = stepperItems.value[currentIndex + 1].name)
        : stepperItems.value[0].name;
  }
};

/* Hooks */
onBeforeMount(() => {
  if (!user.data.activeOrganization) {
    step.value.previous = 'recoveryPhrase';
    step.value.current = 'recoveryPhrase';
    stepperItems.value.shift();
  }

  if (!user.data.organizationState?.passwordTemporary) {
    step.value.previous = 'recoveryPhrase';
    step.value.current = 'recoveryPhrase';
  }
});
</script>
<template>
  <div class="flex-column-100 my-0 mx-auto p-7">
    <div
      class="container-dark-border flex-column-100 col-12 col-lg-10 col-xl-8 col-xxl-6 bg-modal-surface rounded-4 position-relative p-5 mx-auto"
    >
      <template v-if="stepperItems.map(s => s.name).includes(step.current)">
        <div class="w-100 flex-centered flex-column gap-4">
          <h1 class="mt-3 text-title text-bold text-center">Account Setup</h1>
          <p class="mt-3 text-main text-secondary text-center">
            Set your Recovery Phrase and Key Pairs
          </p>
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
          <NewPassword
            :handle-continue="
              () => {
                step.previous = step.current;
                step.current = 'recoveryPhrase';
              }
            "
          />
        </template>

        <!-- Step 2 -->
        <template v-else-if="step.current === 'recoveryPhrase'">
          <GenerateOrImport :handle-next="handleNext" />
        </template>

        <!--Step 3 -->
        <template v-else-if="step.current === 'keyPairs'">
          <KeyPairs ref="keyPairsComponent" v-model:step="step" />
        </template>
      </Transition>

      <div class="d-flex justify-content-between">
        <div class="d-flex">
          <AppButton
            v-if="![stepperItems[0].name, stepperItems[1].name].includes(step.current)"
            color="borderless"
            class="flex-centered mt-6"
            @click="handleBack"
          >
            <i class="bi bi-arrow-left-short text-main"></i> Back</AppButton
          >
        </div>
        <AppButton
          v-if="keyPairs.recoveryPhraseWords.length > 0 && step.current !== 'recoveryPhrase'"
          color="primary"
          @click="handleNext"
          class="ms-3 mt-6"
          >Next</AppButton
        >
      </div>
    </div>
  </div>
</template>
