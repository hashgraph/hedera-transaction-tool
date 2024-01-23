<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

import useUserStore from '../../stores/storeUser';

import AppButton from '../../components/ui/AppButton.vue';
import AppStepper from '../../components/ui/AppStepper.vue';

import Faq from './components/Faq.vue';
import GenerateOrImport from './components/GenerateOrImport.vue';
import KeyPairs from './components/KeyPairs.vue';
import NewPassword from './components/NewPassword.vue';

/* Stores */
const user = useUserStore();

/* State */
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
  <div class="my-0 mx-auto p-7">
    <template v-if="stepperItems[0].name != step.current || isFaqShown">
      <AppButton
        color="secondary"
        class="px-5 position-absolute d-flex align-items-center rounded-4"
        @click="handleBack"
      >
        <i class="bi bi-arrow-left-short text-headline lh-1"></i> Back</AppButton
      >
    </template>

    <Transition name="fade" mode="out-in">
      <template v-if="!isFaqShown">
        <div class="col-12 col-lg-10 col-xl-8 col-xxl-6 bg-modal-surface rounded-4 p-5 mx-auto">
          <template v-if="stepperItems.map(s => s.name).includes(step.current)">
            <div class="w-100 d-flex flex-column justify-content-center align-items-center gap-4">
              <div class="col-12 col-md-10 col-xxl-8">
                <h1 class="mt-3 text-title text-bold text-center">Account Setup</h1>
                <p class="mt-3 text-main text-secondary text-center">
                  Set your Recovery Phrase and Key Pairs
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
                  user.data.mode === 'organization' ? password : user.data.password
                "
                :handle-continue="
                  () => {
                    $router.push({ name: 'settingsKeys' });
                    user.data.password = '';
                  }
                "
              />
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
