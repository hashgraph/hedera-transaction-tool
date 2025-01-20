<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import AppButton from '@renderer/components/ui/AppButton.vue';

import ImportStep from './components/ImportStep.vue';
import RestoreStep from './components/RestoreStep.vue';
import SaveStep from './components/SaveStep.vue';

/* Stores */
const user = useUserStore();

/* Composables */
useSetDynamicLayout(LOGGED_IN_LAYOUT);

/* State */
const step = ref(0);
const index = ref(0);
const mnemonicHashNickname = ref('');
const restoredKey = ref<{ privateKey: string; publicKey: string; mnemonicHash: string } | null>(
  null,
);

/* Handlers */

const handleNickname = (nickname: string) => {
  mnemonicHashNickname.value = nickname;
};

const handleStepValue = () => step.value++;

const handleClearWords = () => (user.recoveryPhrase = null);

/* Hooks */
onBeforeUnmount(() => {
  user.recoveryPhrase = null;
});
</script>
<template>
  <div class="flex-column-100 p-8">
    <div class="position-relative">
      <AppButton color="secondary" @click="$router.back()">Back</AppButton>
    </div>
    <div class="flex-centered flex-column-100">
      <Transition name="fade" mode="out-in">
        <!-- Step 1 -->
        <ImportStep
          v-if="step === 0"
          :user="user"
          @next="
            (nicknameValue: string) => {
              handleNickname(nicknameValue);
              handleStepValue();
            }
          "
          @clear="handleClearWords"
        />

        <!-- Step 2 -->
        <RestoreStep
          v-else-if="step === 1"
          @next="
            (key: typeof restoredKey, enteredIndex: number) => {
              restoredKey = key;
              index = enteredIndex;
              handleStepValue();
            }
          "
        />

        <!-- Step 3 -->
        <SaveStep
          v-else-if="step === 2"
          :restored-key="restoredKey"
          :mnemonic-hash-nickname="mnemonicHashNickname"
          :index="index"
        />
      </Transition>
    </div>
  </div>
</template>
