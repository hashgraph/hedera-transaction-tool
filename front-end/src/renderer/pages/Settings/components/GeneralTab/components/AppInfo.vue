<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import useVersionCheck from '@renderer/composables/useVersionCheck';

/* Composables */
const { versionStatus, latestVersion, isDismissed } =
  useVersionCheck();

/* State */
const version = ref('');

/* Computed */
const showUpgradeButton = computed(() => {
  // Show if any org has an update or is below minimum
  return versionStatus.value === 'updateAvailable' || versionStatus.value === 'belowMinimum';
});

/* Handlers */
const onUpgradeClick = () => {
  // if I reconnect here, it will force the upgrdae for mandatory, so, maybe I check for orgs not connected
  // then reconnect, and if none, then isdismissed false
  isDismissed.value = false;
};

/* Hooks */
onBeforeMount(async () => {
  version.value = await window.electronAPI.local.update.getVersion();
});

/* Misc */
const itemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const itemValueClass = 'text-small overflow-hidden mt-1';
</script>
<template>
  <div class="p-4 border border-2 rounded-3 mt-5">
    <p>App Info</p>
    <div class="mt-4">
      <h4 :class="itemLabelClass">Version</h4>
      <div class="d-flex align-items-center gap-3">
        <p :class="itemValueClass" class="mb-0">
          {{ version }}
        </p>
        <div v-if="showUpgradeButton" class="d-flex align-items-center gap-3 ms-5">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            @click="onUpgradeClick"
          >
            Upgrade
          </button>
          <span class="text-success text-small">
            v{{ latestVersion }} available
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
