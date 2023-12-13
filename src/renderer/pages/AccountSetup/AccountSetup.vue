<script setup lang="ts">
import { ref } from 'vue';

import BeforeSetup from './components/BeforeSetup.vue';

import AppButton from '../../components/ui/AppButton.vue';
import AppStepper from '../../components/ui/AppStepper.vue';

import NewPassword from './components/NewPassword.vue';
import GenerateOrImport from './components/GenerateOrImport.vue';
import KeyPairs from './components/KeyPairs.vue';

const step = ref(-1);
const password = ref('');

const stepperItems = [
  { title: 'New Password', name: 'newPassword' },
  { title: 'Recovery Phrase', name: 'recoveryPhrase' },
  { title: 'Key Pairs', name: 'keyPairs' },
  { title: 'Finish Account Setup', name: 'finishAccountSetup' },
];
</script>
<template>
  <div class="recovery-phrase-page container-page p-8">
    <template v-if="step > 1">
      <AppButton
        color="secondary"
        class="px-5 position-absolute d-flex align-items-center rounded-4"
        @click="step--"
      >
        <i class="bi bi-arrow-left-short text-headline lh-1"></i> Back</AppButton
      >
    </template>
    <template v-if="step > -1">
      <div class="w-100 d-flex flex-column justify-content-center align-items-center gap-4">
        <div class="col-12 col-md-10 col-xxl-8">
          <h1 class="mt-3 text-huge text-bold text-center">Account Setup</h1>
          <p class="mt-5 text-center">
            Durring this two steps you are going to set up your recovery phrase and key pairs
          </p>
          <div class="mt-8">
            <AppStepper :items="stepperItems" :active-index="step"> </AppStepper>
          </div>
        </div>
      </div>
    </template>

    <Transition name="fade" mode="out-in">
      <!-- Step 0 -->
      <template v-if="step === -1">
        <BeforeSetup v-model:step="step" />
      </template>

      <!-- Step 1 -->
      <template v-else-if="step === 0">
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
    </Transition>
    <!-- <AppModal v-model:show="isSuccessModalShown" class="common-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isSuccessModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i
            class="bi bi-check-circle-fill extra-large-icon cursor-pointer"
            style="line-height: 16px"
            @click="isSuccessModalShown = false"
          ></i>
        </div>

        <h3 class="mt-5 text-main text-center text-bold">{{ modalText }}</h3>
        <p class="text-center text-small">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
        <AppButton color="primary" size="large" class="mt-5 w-100 rounded-4" @click="handleContinue"
          >Continue</AppButton
        >
      </div>
    </AppModal> -->
  </div>
</template>
