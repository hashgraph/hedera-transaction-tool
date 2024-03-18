<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { useRouter } from 'vue-router';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppStepper from '@renderer/components/ui/AppStepper.vue';

import Faq from './components/Faq.vue';
import GenerateOrImport from './components/GenerateOrImport.vue';
import KeyPairs from './components/KeyPairs.vue';
import NewPassword from './components/NewPassword.vue';

/* Stores */
const user = useUserStore();
const keyPairs = useKeyPairsStore();

/* Composables */
const router = useRouter();

/* State */
const keyPairsComponent = ref<typeof KeyPairs | null>(null);
const step = ref({ previous: 'newPassword', current: 'newPassword' });
const stepperItems = ref([
  { title: 'New Password', name: 'newPassword' },
  { title: 'Recovery Phrase', name: 'recoveryPhrase' },
  { title: 'Key Pairs', name: 'keyPairs' },
]);
const password = ref('');
const isFaqShown = ref(false);

/* Handlers */
const handleBack = () => {
  if (isFaqShown.value) {
    isFaqShown.value = false;
  } else {
    step.value.current = step.value.previous;
    const currentPrevIndex = stepperItems.value.findIndex(i => i.name === step.value.previous);
    step.value.previous =
      currentPrevIndex > 0
        ? (step.value.previous = stepperItems.value[currentPrevIndex - 1].name)
        : stepperItems.value[0].name;
  }
};

const handleNext = async () => {
  if (isFaqShown.value) {
    isFaqShown.value = false;
  } else {
    step.value.previous = step.value.current;
    const currentIndex = stepperItems.value.findIndex(i => i.name === step.value.current);

    if (currentIndex + 1 === stepperItems.value.length) {
      await keyPairsComponent.value?.handleSaveKey();
      user.data.password = '';

      router.push({ name: 'settingsKeys' });
    } else {
      step.value.current =
        currentIndex >= 0
          ? (step.value.current = stepperItems.value[currentIndex + 1].name)
          : stepperItems.value[0].name;
    }
  }
};

/* Hooks */
onBeforeMount(() => {
  if (user.data.mode === 'personal') {
    step.value.previous = 'recoveryPhrase';
    step.value.current = 'recoveryPhrase';
    stepperItems.value.shift();
  }
});
</script>
<template>
  <div class="flex-column-100 my-0 mx-auto p-7">
    <Transition name="fade" mode="out-in">
      <template v-if="!isFaqShown">
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
                  newPassword => {
                    password = newPassword;
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
              <KeyPairs
                ref="keyPairsComponent"
                v-model:step="step"
                :encrypt-password="
                  user.data.mode === 'organization' ? password : user.data.password
                "
              />
            </template>
          </Transition>

          <div class="d-flex justify-content-between">
            <div class="d-flex">
              <AppButton
                v-if="
                  stepperItems[0].name != step.current ||
                  (user.data.mode === 'organization' && stepperItems[1].name != step.current) ||
                  isFaqShown
                "
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
      </template>
      <template v-else>
        <Faq />
      </template>
    </Transition>
  </div>
</template>
