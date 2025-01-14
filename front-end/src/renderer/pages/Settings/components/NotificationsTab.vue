<script setup lang="ts">
import { NotificationType } from '@main/shared/interfaces';

import useNotificationsStore from '@renderer/stores/storeNotifications';

import useRedirectOnOnlyOrganization from '@renderer/composables/useRedirectOnOnlyOrganization';

import AppSwitch from '@renderer/components/ui/AppSwitch.vue';

/* Stores */
const notifications = useNotificationsStore();

/* Composable */
useRedirectOnOnlyOrganization();

/* Handlers */
const handlePreferenceChange = (type: NotificationType, email: boolean) => {
  notifications.updatePreferences({ type, email });
};
</script>

<template>
  <div>
    <div class="fill-remaining border border-2 rounded-3 p-4">
      <p>Email notifications</p>
      <div class="mt-4">
        <AppSwitch
          :checked="
            notifications.notificationsPreferences[NotificationType.TRANSACTION_READY_FOR_EXECUTION]
          "
          @update:checked="
            handlePreferenceChange(NotificationType.TRANSACTION_READY_FOR_EXECUTION, $event)
          "
          name="threshold-reached"
          label="Transaction Threshold Reached"
        />
        <p class="text-small text-secondary mt-2">
          You will be notified when a transaction you are a Creator in has collected enough
          signature to satisfy the threshold.
        </p>
      </div>
      <div class="mt-6">
        <AppSwitch
          :checked="
            notifications.notificationsPreferences[
              NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES
            ]
          "
          @update:checked="
            handlePreferenceChange(NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES, $event)
          "
          name="required-signatures"
          label="Required Signature"
        />
        <p class="text-small text-secondary mt-2">
          You will be notified whenever a transaction, which requires your signature has been
          created.
        </p>
      </div>
    </div>
  </div>
</template>
