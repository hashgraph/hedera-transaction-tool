<script setup lang="ts">
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  type ActionReport,
  ActionStatus,
} from '@renderer/components/ActionController/ActionReport';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import { ToastManager } from '@renderer/utils/ToastManager';
import { deleteKeyPair } from '@renderer/services/keyPairService';
import { assertIsLoggedInOrganization } from '@renderer/utils';
import { deleteKey } from '@renderer/services/organization';
import type { KeyInfo } from '@renderer/composables/useKeyManager';

/* Props */
const props = defineProps<{
  keyInfos: KeyInfo[];
  callback: () => Promise<void>;
}>();
const activate = defineModel<boolean>('activate', { required: true });

/* Injected */
const toastManager = ToastManager.inject();

/* Stores */
const user = useUserStore();

/* Handlers */
const handleDelete = async (): Promise<ActionReport | null> => {
  const failedKeyInfos: KeyInfo[] = [];
  for (const keyInfo of props.keyInfos) {
    try {
      await deleteOneKey(keyInfo);
    } catch {
      failedKeyInfos.push(keyInfo);
    }
  }
  await invokeCallback();

  let result: ActionReport | null;
  if (failedKeyInfos.length === 0) {
    const message =
        props.keyInfos.length === 1
          ? 'Private key pair deleted successfully'
          : 'Private key pair(s) deleted successfully'
    toastManager.success(message);
    result = null;
  } else if (failedKeyInfos.length < props.keyInfos.length) {
    // At least one key has been deleted correctly
    result = {
      status: ActionStatus.Warning,
      title: 'Delete key',
      what:
        failedKeyInfos.length === 1
          ? `Failed to delete key pair ${failedKeyInfos[0].publicKey}`
          : `Failed to delete ${failedKeyInfos.length} key pairs`,
    };
  } else {
    // All delete operations failed
    result = {
      status: ActionStatus.Warning,
      title: 'Delete key',
      what:
        props.keyInfos.length === 1 ? `Failed to delete key pair` : `Failed to delete key pairs`,
    };
  }
  return result;
};

const deleteOneKey = async (keyInfo: KeyInfo): Promise<void> => {
  // 1) Deletes locally if any
  if (keyInfo.keyPair !== null) {
    await deleteKeyPair(keyInfo.keyPair.id);
  }
  // 2) Deletes remotely if any
  if (keyInfo.userKey !== null) {
    assertIsLoggedInOrganization(user.selectedOrganization);
    await deleteKey(
      user.selectedOrganization.serverUrl,
      user.selectedOrganization.userId,
      keyInfo.userKey.id,
    )
  }
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
    :actionCallback="handleDelete"
    action-button-text="Delete"
    cancel-button-text="Do not delete"
    confirm-text="You are about to delete the selected key pair(s). Do you wish to continue?"
    confirm-title="Delete key pair"
    data-testid="button-delete-keypair"
    progress-title="Delete key pair"
    progress-text="Deleting key pair(s)…"
  />
</template>
