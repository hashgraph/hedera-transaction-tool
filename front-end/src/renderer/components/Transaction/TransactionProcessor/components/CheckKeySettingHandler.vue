<script setup lang="ts">
import AppModal from '@renderer/components/ui/AppModal.vue';
import { ref, type Ref } from 'vue';
import type { Handler, Processable } from '@renderer/components/Transaction/TransactionProcessor';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { getErrorMessage } from '@renderer/utils';
import { errorToastOptions } from '@renderer/utils/toastOptions.ts';
import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import storeUser from '@renderer/stores/storeUser';

/* Props */
const props = defineProps<{
  hasDataChanged: boolean;
  saveDraft: () => Promise<void>;
}>();

/* Composables */
const router = useRouter();
const toast = useToast();

/* Stores */
const user = storeUser();

/* State */
const request: Ref<Processable | null> = ref(null);
const nextHandler: Ref<Handler | null> = ref(null);
const show = ref(false);
const saving = ref(false);

/* Actions */
function setNext(next: Handler) {
  nextHandler.value = next;
}

function handle(req: Processable) {
  request.value = req;
  // If user has no private key setup, we show the modal
  if (user.keyPairs.length === 0) {
    show.value = true;
  } else if (nextHandler.value !== null) {
    nextHandler.value.handle(request.value);
  }
}

function setShow(value: boolean) {
  show.value = value;
}

/* Handlers */
const handleSaveAndGoToSettings = async () => {
  saving.value = true;
  try {
    if (props.hasDataChanged) {
      await props.saveDraft();
    }
    show.value = false;
    await router.push('/settings/keys');
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to save draft'), errorToastOptions);
  } finally {
    saving.value = false;
  }
};

/* Expose */
defineExpose({
  handle,
  setNext,
  setShow,
});
</script>

<template>
  <AppModal v-model:show="show" :close-on-click-outside="false" :close-on-escape="false">
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="show = false"></i>
      </div>
      <form @submit.prevent="handleSaveAndGoToSettings">
        <h3 class="text-center text-title text-bold mt-5">Setup your Private Key</h3>
        <p class="text-center text-small text-secondary mt-4">
          <template v-if="props.hasDataChanged">
            <template v-if="user.selectedOrganization">
              Before creating and sharing your transaction, you need to setup your private key
              first. Save your transaction draft, go to <code class="text-small">Settings</code>,
              import your private key and retry.
            </template>
            <template v-else>
              Before signing and executing your transaction you need to setup your private key
              first. Save your transaction draft, go to <code class="text-small">Settings</code>,
              import your private key and retry.
            </template>
          </template>
          <template v-else>
            <template v-if="user.selectedOrganization">
              Before creating and sharing your transaction, you need to setup your private key
              first. Go to <code class="text-small">Settings</code>, import your private key and
              retry.
            </template>
            <template v-else>
              Before signing and executing your transaction, you need to setup your private key
              first. Go to <code class="text-small">Settings</code>, import your private key and
              retry.
            </template>
          </template>
        </p>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton
            type="button"
            color="borderless"
            data-testid="button-cancel-transaction"
            @click="show = false"
            :disabled="saving"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            type="submit"
            :data-testid="props.hasDataChanged ? 'button-save-goto-settings' : 'button-goto-settings'"
            :loading="saving"
            loading-text="Saving Draft…"
            :disabled="saving"
          >
            <template v-if="props.hasDataChanged"> Save Draft and Go to Settings </template>
            <template v-else>Go to Settings</template>
          </AppButton>
        </div>
      </form>
    </div>
  </AppModal>
</template>
