<script setup lang="ts">
import { ref } from 'vue';
import { decryptPassphrase } from '../services/recoveryPhraseService';

const step = ref(1);
const recoveryPhrase = ref<string[]>([]);

const userPassword = ref('');

const handleUnlockRecoveryPhrase = async () => {
  // Logic for matching User password with the given one

  //
  step.value++;

  try {
    recoveryPhrase.value = await decryptPassphrase();
    console.log(recoveryPhrase.value);
  } catch (error) {
    console.log(error);
  }
};
</script>
<template>
  <div class="container-page p-10">
    <Transition name="fade" mode="out-in">
      <!-- Step 1 -->
      <div v-if="step === 1">
        <h2 class="text-center">Enter your password to reveal the recovery phrase</h2>
        <div class="w-50 mt-6 mx-auto d-flex flex-column gap-4">
          <div>
            <label for="password">Password</label>
            <input
              type="password"
              name="password"
              class="form-control py-3"
              v-model="userPassword"
            />
          </div>
        </div>
        <div class="mt-8 text-center">
          <button class="btn btn-primary text-subheader" @click="handleUnlockRecoveryPhrase">
            Unlock
          </button>
        </div>
      </div>
      <!-- Step 2 -->
      <div v-else-if="step === 2">
        <h3 class="text-center">Do not send this to anyone!</h3>
        <div class="mt-6 d-flex align-items-center justify-content-around flex-wrap gap-4">
          <div
            v-for="(word, index) in recoveryPhrase || []"
            :key="index"
            class="col-3 px-5 py-4 bg-info border-main-gradient text-center"
          >
            {{ word }}
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
