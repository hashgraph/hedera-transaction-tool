<script setup lang="ts">
import { ref, watch } from 'vue';

import { CommonNetwork } from '@main/shared/enums';

import { useGroupedNotifications } from './composables';

/* Mappings */
const networkMapping: {
  [key in string]: { label: string; className: string };
} = {
  [CommonNetwork.TESTNET]: {
    label: 'TESTNET',
    className: 'text-testnet',
  },
  [CommonNetwork.MAINNET]: {
    label: 'MAINNET',
    className: 'text-mainnet',
  },
  [CommonNetwork.PREVIEWNET]: {
    label: 'PREVIEWNET',
    className: 'text-previewnet',
  },
  [CommonNetwork.LOCAL_NODE]: {
    label: 'LOCAL NODE',
    className: 'text-info',
  },
};

/* Composables */
const { groupedNotifications, totalCount } = useGroupedNotifications();

/* State */
const isRinging = ref<boolean>(false);

/* Functions */
const triggerRingAnimation = () => {
  isRinging.value = true;
  setTimeout(() => {
    isRinging.value = false;
  }, 2000);
};

/* Watchers */
let previousTotalCount = totalCount.value;
watch(totalCount, (newCount) => {
  if (newCount > previousTotalCount) {
    triggerRingAnimation();
  }
  previousTotalCount = newCount;
});
</script>
<template>
  <div class="dropdown">
    <div class="position-relative" data-bs-toggle="dropdown">
      <span
        class="container-icon p-0 m-3"
        data-testid="button-notifications"
        :class="{ ringing: isRinging }"
      >
        <i class="bi bi-bell-fill text-secondary text-subheader fs-4"></i>
      </span>
      <template v-if="totalCount > 0">
        <span
          class="indicator-circle position-absolute absolute-centered"
          data-testid="notification-indicator"
          :style="{ left: 'unset', right: '10%', top: '35%', width: '10px', height: '10px' }"
        ></span>
      </template>
    </div>

    <div class="dropdown-menu overflow-hidden" :style="{ width: '300px' }">
      <ul class="overflow-auto" :style="{ maxHeight: '45vh' }">
        <template
          v-for="[serverUrl, networkToNotifications] of Object.entries(groupedNotifications)"
          :key="serverUrl"
        >
          <template
            v-for="[network, notifications] of Object.entries(networkToNotifications)"
            :key="network"
          >
            <template
              v-for="notification of notifications"
              :key="`${notification.content}${notification.network}`"
            >
              <li class="dropdown-item text-small cursor-pointer user-select-none" @click="notification.action()">
                <div class="row">
                  <div class="col-8" :class="{ 'col-12': notification.network === 'Unknown' }">
                    <p class="text-truncate">
                      <strong>{{ serverUrl }}</strong>
                    </p>
                  </div>
                  <template v-if="notification.network !== 'Unknown'">
                    <div
                      class="col-4 text-end"
                      :class="networkMapping[notification.network]?.className || 'text-info'"
                    >
                      {{ networkMapping[notification.network]?.label || 'CUSTOM' }}
                    </div>
                  </template>
                </div>
                <div>
                  <p class="text-truncate">
                    {{ notification.content }}
                    <span v-if="notification.count > 1">({{ notification.count }})</span>
                  </p>
                </div>
              </li>
            </template>
          </template>
        </template>
      </ul>
    </div>
  </div>
</template>
