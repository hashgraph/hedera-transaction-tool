<script setup lang="ts">
import { useGroupedNotifications } from './composables';

/* Composables */
const { groupedNotifications, totalCount } = useGroupedNotifications();
</script>
<template>
  <div class="dropdown">
    <div class="position-relative" data-bs-toggle="dropdown">
      <span class="container-icon" data-testid="button-notifications">
        <i class="bi bi-bell-fill text-secondary text-subheader"></i>
      </span>
      <template v-if="totalCount > 0">
        <span
          class="indicator-circle position-absolute absolute-centered"
          :style="{ left: 'unset', right: '20%', top: '40%', width: '8px', height: '8px' }"
        ></span>
      </template>
    </div>

    <ul class="dropdown-menu" :style="{ width: 'max-content' }">
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
            <li class="dropdown-item text-small cursor-pointer" @click="notification.action()">
              <div class="row">
                <div class="col-7">
                  <p class="text-truncate">
                    {{ serverUrl }}
                  </p>
                </div>
                <div class="col-5 text-end">
                  {{ notification.network }}
                </div>
              </div>
              <div>
                <p>
                  <span v-if="notification.count > 1">({{ notification.count }})</span>
                  {{ notification.content }}
                </p>
              </div>
            </li>
          </template>
        </template>
      </template>
    </ul>
  </div>
</template>
