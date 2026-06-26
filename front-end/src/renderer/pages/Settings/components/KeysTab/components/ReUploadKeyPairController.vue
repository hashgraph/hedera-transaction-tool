<script setup lang="ts">
import { type ActionReport } from '@renderer/components/ActionController/ActionReport';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import type { KeyInfo } from '@renderer/composables/useKeyManager';
import useUserStore from '@renderer/stores/storeUser';
import { ToastManager } from '@renderer/utils/ToastManager';
import { isLoggedInOrganization } from '@renderer/utils';
import { uploadKey } from '@renderer/services/organization';

/* Props */
const props = defineProps<{
  keyInfo: KeyInfo | null;
  callback: () => Promise<void>;
}>();
const activate = defineModel<boolean>('activate', { required: true });

/* Injected */
const toastManager = ToastManager.inject();

/* Stores */
const user = useUserStore();

/* Handlers */
const handleReUpload = async (): Promise<ActionReport | null> => {
  let result: ActionReport | null;
  const keyPair = props.keyInfo?.keyPair;
  if (keyPair && isLoggedInOrganization(user.selectedOrganization)) {
    try {
      await uploadKey(user.selectedOrganization.serverUrl, user.selectedOrganization.userId, {
        publicKey: keyPair.public_key,
        index: keyPair.index != -1 ? keyPair.index : undefined,
        mnemonicHash: keyPair.secret_hash ?? undefined,
      });
      result = null;
      toastManager.success('Key re-uploaded to server successfully!');
    } finally {
      await invokeCallback();
    }
  } else {
    result = null;
  }
  return result;
};

const invokeCallback = async () => {
  try {
    await props.callback();
  } catch {
    // callback should handle that
  }
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleReUpload"
    data-testid="button-re-upload-keypair"
    progress-title="Re-upload key pair"
    progress-text="Re-uploading key pair…"
  />
</template>
