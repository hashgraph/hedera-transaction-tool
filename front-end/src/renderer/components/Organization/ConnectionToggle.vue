<script setup lang="ts">
import { ref, computed } from 'vue';
import router from '@renderer/router';

import type { ConnectedOrganization } from '@renderer/types/userStore';

import useOrganizationConnection from '@renderer/stores/storeOrganizationConnection';
import { disconnectOrganization } from '@renderer/services/organization/disconnect';
import { reconnectOrganization } from '@renderer/services/organization/reconnect';
import { isLoggedOutOrganization } from '@renderer/utils';

import { useToast } from 'vue-toast-notification';
import { errorToastOptions } from '@renderer/utils/toastOptions';

import AppSwitch from '@renderer/components/ui/AppSwitch.vue';

/* Props */
const props = defineProps<{
  organization: ConnectedOrganization;
  disabled?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'connect'): void;
  (event: 'disconnect'): void;
  (event: 'error', error: Error): void;
}>();

/* Stores */
const orgConnection = useOrganizationConnection();
const toast = useToast();

/* State */
const isProcessing = ref(false);

/* Computed */
const isConnected = computed(() => {
  const status = orgConnection.getConnectionStatus(props.organization.serverUrl);
  return status === 'connected';
});

const isDisabled = computed(() => {
  return props.disabled || isProcessing.value;
});

/* Handlers */
const handleToggle = async (checked: boolean) => {
  if (isProcessing.value) return;

  isProcessing.value = true;

  try {
    if (checked) {
      await handleReconnect();
    } else {
      await handleDisconnect();
    }
  } catch (error) {
    console.error('Connection toggle error:', error);
    emit('error', error instanceof Error ? error : new Error('Unknown error'));
    toast.error(`Failed to ${checked ? 'connect' : 'disconnect'} organization`, errorToastOptions);
  } finally {
    isProcessing.value = false;
  }
};

const handleReconnect = async () => {
  const result = await reconnectOrganization(props.organization.serverUrl);

  if (result.success) {
    if (isLoggedOutOrganization(props.organization)) {
      await router.push({ name: 'organizationLogin' });
    }
    emit('connect');
  } else {
    throw new Error('Failed to reconnect');
  }
};

const handleDisconnect = async () => {
  await disconnectOrganization(props.organization.serverUrl, 'manual');
  emit('disconnect');
};
</script>
<template>
  <AppSwitch
    :name="`connection-toggle-${organization.id}`"
    :checked="isConnected"
    :disabled="isDisabled"
    size="md"
    class="mb-0 me-2"
    @update:checked="handleToggle"
    data-testid="connection-toggle"
  />
</template>
