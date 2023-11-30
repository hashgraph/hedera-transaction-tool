<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import AppButton from '../../components/ui/AppButton.vue';

import GenerateOrImport from './components/GenerateOrImport.vue';
import Generate from './components/Generate.vue';
import Import from './components/Import.vue';

const router = useRouter();

const recoveryPhrase = ref<string[] | null>(null);
const step = ref(1);
const type = ref<'generate' | 'import' | ''>('');
const ableToContinue = ref(false);

watch(recoveryPhrase, newRecoveryPhrase => {
  if (!newRecoveryPhrase) {
    ableToContinue.value = false;
  } else if (newRecoveryPhrase.length === 24) {
    ableToContinue.value = true;
  }
});
watch(step, newStep => {
  if ([1, 3].includes(newStep)) {
    ableToContinue.value = false;
  }
});

const navigateToKeys = () => {
  router.push({ path: '/settings/keys' });
};
</script>
<template>
  <div class="container-page p-10">
    <!-- Go back -->
    <div class="d-flex justify-content-between">
      <AppButton
        outline
        color="primary"
        class="py-0 px-2 mb-4 text-title"
        v-if="step != 1"
        @click="step--"
      >
        <i class="bi-arrow-left"></i>
      </AppButton>
    </div>
    <Transition name="fade" mode="out-in">
      <!-- Step 1 -->
      <template v-if="step === 1">
        <div class="h-100">
          <GenerateOrImport
            v-model:step="step"
            v-model:recoveryPhrase="recoveryPhrase"
            v-model:type="type"
          />
        </div>
      </template>
      <!-- Step 2 -->
      <template v-else-if="step === 2">
        <Generate
          v-if="type === 'generate'"
          v-model:recoveryPhrase="recoveryPhrase"
          :handleFinish="navigateToKeys"
        />
        <Import
          v-else-if="type === 'import'"
          v-model:recoveryPhrase="recoveryPhrase"
          :ableToContinue="ableToContinue"
          :handleFinish="navigateToKeys"
        />
      </template>
    </Transition>
  </div>
</template>
