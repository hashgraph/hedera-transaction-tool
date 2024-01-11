<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

import useLocalUserStateStore from '../../stores/storeLocalUserState';
import useUserStateStore from '../../stores/storeUserState';

import AppButton from '../../components/ui/AppButton.vue';
import AppStepper from '../../components/ui/AppStepper.vue';

import Faq from './components/Faq.vue';
import FinishSetup from './components/FinishSetup.vue';
import GenerateOrImport from './components/GenerateOrImport.vue';
import KeyPairs from './components/KeyPairs.vue';
import NewPassword from './components/NewPassword.vue';

/* Stores */
const localUserStore = useLocalUserStateStore();
const userStore = useUserStateStore();

/* State */
const step = ref({ previous: 'newPassword', current: 'newPassword' });
const stepperItems = ref([
  { title: 'New Password', name: 'newPassword' },
  { title: 'Recovery Phrase', name: 'recoveryPhrase' },
  { title: 'Key Pairs', name: 'keyPairs' },
  { title: 'Finish Account Setup', name: 'finishAccountSetup' },
]);

const password = ref('');
const isFaqShown = ref(false);

onBeforeMount(() => {
  if (!userStore.isLoggedIn) {
    step.value.previous = 'recoveryPhrase';
    step.value.current = 'recoveryPhrase';
    stepperItems.value.shift();
  }
});
</script>
<template>
  <div class="recovery-phrase-page container-page p-8">
    <template v-if="stepperItems[0].name != step.current || isFaqShown">
      <AppButton
        color="secondary"
        class="px-5 position-absolute d-flex align-items-center rounded-4"
        @click="isFaqShown ? (isFaqShown = false) : (step.current = step.previous)"
      >
        <i class="bi bi-arrow-left-short text-headline lh-1"></i> Back</AppButton
      >
    </template>

    <Transition name="fade" mode="out-in">
      <template v-if="!isFaqShown">
        <div>
          <template v-if="stepperItems.map(s => s.name).includes(step.current)">
            <div class="w-100 d-flex flex-column justify-content-center align-items-center gap-4">
              <div class="col-12 col-md-10 col-xxl-8">
                <h1 class="mt-3 text-huge text-bold text-center">Account Setup</h1>
                <p class="mt-5 text-center">
                  During this setup you are going to set up your recovery phrase and key pairs.
                  <span
                    class="link link-primary text-decoration-underline"
                    @click="isFaqShown = true"
                    >See more</span
                  >
                </p>
                <div class="mt-8">
                  <AppStepper
                    :items="stepperItems"
                    :active-index="stepperItems.findIndex(s => s.name === step.current)"
                  >
                  </AppStepper>
                </div>
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
              <GenerateOrImport
                :handle-continue="
                  () => {
                    step.previous = step.current;
                    step.current = 'keyPairs';
                  }
                "
              />
            </template>

            <!--Step 3 -->
            <template v-else-if="step.current === 'keyPairs'">
              <KeyPairs
                v-model:step="step"
                :encrypt-password="
                  userStore.isLoggedIn ? password : localUserStore.userState.password || ''
                "
                :handle-continue="
                  () => {
                    step.previous = step.current;
                    step.current = 'finishAccountSetup';
                  }
                "
              />
            </template>

            <!--Step 4 -->
            <template v-else-if="step.current === 'finishAccountSetup'">
              <FinishSetup v-model:step="step" />
            </template>
          </Transition>
        </div>
      </template>
      <template v-else>
        <Faq />
      </template>
    </Transition>
  </div>
</template>
