<script setup lang="ts">
import { ref } from 'vue';

import AppSwitch from '@renderer/components/ui/AppSwitch.vue';

import useNotificationsStore from '@renderer/stores/storeNotifications';

/* Stores */
const notificationsStore = useNotificationsStore();

/* State */
const threshholdReached = ref(notificationsStore.notifications.email['threshhold-reached']);
const requiredSignatures = ref(notificationsStore.notifications.email['required-signatures']);
</script>

<template>
  <div>
    <div class="fill-remaining border border-2 rounded-3 p-4">
      <p>Email notifications</p>
      <div class="mt-4">
        <AppSwitch
          v-model:checked="threshholdReached"
          name="threshhold-reached"
          label="Transaction Threshold Reached"
        />
        <p class="text-small text-secondary mt-2">
          You will be notified when a transaction you are a Creator in has collected enough
          signature to satisfy the threshold.
        </p>
      </div>
      <div class="mt-6">
        <AppSwitch
          v-model:checked="requiredSignatures"
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
