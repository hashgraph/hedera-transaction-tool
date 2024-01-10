<script setup lang="ts">
import { ref } from 'vue';

import AppButton from '../../components/ui/AppButton.vue';
import AppStepper from '../../components/ui/AppStepper.vue';

import Faq from './components/Faq.vue';
import FinishSetup from './components/FinishSetup.vue';
import GenerateOrImport from './components/GenerateOrImport.vue';
import KeyPairs from './components/KeyPairs.vue';
import NewPassword from './components/NewPassword.vue';

/* State */
const step = ref(0);
const password = ref('');

const isFaqShown = ref(false);

/* Misc */
const stepperItems = [
  { title: 'New Password', name: 'newPassword' },
  { title: 'Recovery Phrase', name: 'recoveryPhrase' },
  { title: 'Key Pairs', name: 'keyPairs' },
  { title: 'Finish Account Setup', name: 'finishAccountSetup' },
];
</script>
<template>
  <div class="recovery-phrase-page container-page p-8">
    <template v-if="step > 1 || isFaqShown">
      <AppButton
        color="secondary"
        class="px-5 position-absolute d-flex align-items-center rounded-4"
        @click="isFaqShown ? (isFaqShown = false) : step--"
      >
        <i class="bi bi-arrow-left-short text-headline lh-1"></i> Back</AppButton
      >
    </template>

    <Transition name="fade" mode="out-in">
      <template v-if="!isFaqShown">
        <div>
          <template v-if="step > -1">
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
                  <AppStepper :items="stepperItems" :active-index="step"> </AppStepper>
                </div>
              </div>
            </div>
          </template>

          <Transition name="fade" mode="out-in">
            <!-- Step 1 -->
            <template v-if="step === 0">
              <NewPassword
                :handle-continue="
                  newPassword => {
                    password = newPassword;
                    step++;
                  }
                "
              />
            </template>

            <!-- Step 2 -->
            <template v-else-if="step === 1">
              <GenerateOrImport :handle-continue="() => step++" />
            </template>

            <!--Step 3 -->
            <template v-else-if="step === 2">
              <KeyPairs
                v-model:step="step"
                :encrypt-password="password"
                :handle-continue="() => step++"
              />
            </template>

            <!--Step 4 -->
            <template v-else-if="step === 3">
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
