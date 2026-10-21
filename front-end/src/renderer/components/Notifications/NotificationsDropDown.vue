<script setup lang="ts">
import { ref, watch } from 'vue';

import { networkMapping } from '@shared/constants';

import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';

import { useGroupedNotifications } from './composables';
import { setDockBounce } from '@renderer/services/electronUtilsService';

/* Composables */
const { groupedNotifications, totalCount, pendingNetworkHost, confirmNetwork, cancelNetwork } =
  useGroupedNotifications();

/* State */
const showNetworkConfirm = ref(false);
const isRinging = ref<boolean>(false);

/* Functions */
const triggerRingAnimation = () => {
  isRinging.value = true;
  setTimeout(() => {
    isRinging.value = false;
  }, 2000);

  setDockBounce();
};

/* Watchers */
watch(pendingNetworkHost, host => {
  showNetworkConfirm.value = host !== null;
});

let previousTotalCount = totalCount.value;
watch(totalCount, newCount => {
  if (newCount > previousTotalCount) {
    triggerRingAnimation();
  }
  previousTotalCount = newCount;
});
</script>
<template>
  <div class="dropdown ms-2">
    <div class="position-relative" data-bs-toggle="dropdown">
      <span
        class="container-icon p-0 m-3"
        data-testid="button-notifications"
        :class="{ ringing: isRinging }"
      >
        <i class="bi bi-bell-fill text-secondary text-subheader fs-2"></i>
      </span>
      <template v-if="totalCount > 0">
        <span
          class="position-absolute badge rounded-pill bg-danger"
          :class="{ 'small-badge': totalCount > 9 }"
          data-testid="notification-indicator"
          :style="{ left: 'unset', right: '0%', top: '0%' }"
          >{{ totalCount > 9 ? '9+' : totalCount }}</span>
      </template>
    </div>

    <div class="dropdown-menu overflow-hidden" :style="{ width: '320px' }">
      <ul class="overflow-auto" :style="{ maxHeight: '45vh' }">
        <template v-if="totalCount === 0">
          <li class="dropdown-item text-small text-center user-select-none">No notifications</li>
        </template>
        <template v-else>
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
                <li
                  class="dropdown-item text-small cursor-pointer user-select-none"
                  @click="notification.action()"
                >
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
        </template>
      </ul>
    </div>
    <AppConfirmModal
      v-model:show="showNetworkConfirm"
      title="Switch to custom network?"
      :text="`This notification wants to switch the app to the custom network ${pendingNetworkHost}. That host will provide account, key and node data and receive the transactions you sign. Only continue if you recognize and trust it.`"
      button-text="Switch Network"
      button-color="danger"
      icon="error"
      :callback="confirmNetwork"
      :cancel="cancelNetwork"
      data-testid="modal-notification-network-switch"
    />
  </div>
</template>
