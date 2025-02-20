<script setup lang="ts">
import { ref, watch } from 'vue';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import useSetDynamicLayout, {
  ACCOUNT_SETUP_LAYOUT,
} from '@renderer/composables/useSetDynamicLayout';
import useMatchRecoveryPrase from '@renderer/composables/useMatchRecoveryPhrase';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import Import from '@renderer/components/RecoveryPhrase/Import.vue';

/* Composables */
useSetDynamicLayout(ACCOUNT_SETUP_LAYOUT);
const toast = useToast();
const router = useRouter();
const { startMatching } = useMatchRecoveryPrase();

/* State */
const loadingText = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const startIndex = ref<number>(0);
const endIndex = ref<number>(100);
const abortController = ref<AbortController | null>(null);
const totalRecovered = ref<number>(0);

/* Handlers */
const handleContinue = async () => {
  await router.back();
};

const handleSearch = async () => {
  loadingText.value = 'Matching keys...';
  try {
    abortController.value = new AbortController();

    const count = await startMatching(startIndex.value, endIndex.value, abortController.value);
    totalRecovered.value = count;

    const message = count === 0 ? 'No keys matched' : `Matched ${count} keys to recovery phrase`;
    toast.success(message);
  } finally {
    loadingText.value = null;
  }
};

const handleAbort = async () => {
  loadingText.value = 'Aborting the search...';
  abortController.value?.abort();
  loadingText.value = null;
};

watch([startIndex, endIndex], async ([start, end]) => {
  if (start > end) {
    errorMessage.value = 'Start index must be less than end index';
  } else {
    errorMessage.value = null;
  }
});
</script>
<template>
  <div class="flex-column-100 flex-centered">
    <div class="fill-remaining d-flex align-items-center p-6">
      <div class="container-dark-border bg-modal-surface glow-dark-bg p-5">
        <h4 class="text-title text-semi-bold text-center">
          Match External Keys to Recovery Phrase
        </h4>
        <p class="text-main text-center mt-3">
          Enter a recovery phrase to automatically match your external keys to it.
        </p>
        <div class="mt-4">
          <Import />
        </div>

        <hr class="separator my-4 mx-3" />

        <div class="mt-4 col-12 col-lg-6 d-flex gap-4 ms-3">
          <AppInput
            v-model="startIndex"
            :filled="true"
            data-testid="input-start-index"
            type="number"
            placeholder="Enter start index"
          />
          <AppInput
            v-model="endIndex"
            :filled="true"
            data-testid="input-end-index"
            type="number"
            placeholder="Enter end index"
          />
        </div>

        <div class="mt-5 ms-3">
          <p :class="{ 'text-danger': errorMessage }">
            {{ errorMessage ? errorMessage : `Total keys recovered: ${totalRecovered}` }}
          </p>
        </div>

        <div class="flex-centered justify-content-between mt-5 mx-3">
          <div class="d-flex gap-4">
            <AppButton color="secondary" @click="handleAbort" data-testid="button-abort"
              >Abort</AppButton
            >
          </div>

          <div class="d-flex gap-4">
            <div>
              <AppButton
                color="primary"
                @click="handleSearch"
                data-testid="button-abort"
                :disabled="Boolean(loadingText)"
                :loading="Boolean(loadingText)"
                :loading-text="loadingText || ''"
                >Search</AppButton
              >
            </div>
            <div>
              <AppButton
                color="secondary"
                @click="handleContinue"
                data-testid="button-next"
                :disabled="Boolean(loadingText)"
                >Continue</AppButton
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
