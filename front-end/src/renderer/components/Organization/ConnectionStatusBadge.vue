<script setup lang="ts">
import { computed } from 'vue';

import type { ConnectionStatus, DisconnectReason } from '@renderer/types/userStore';

/* Props */
const props = withDefaults(
  defineProps<{
    status: ConnectionStatus;
    reason?: DisconnectReason;
    organizationName?: string;
    hasCompatibilityConflict?: boolean;
  }>(),
  {
    hasCompatibilityConflict: false,
  },
);

/* Computed */
const badgeClass = computed(() => {
  switch (props.status) {
    case 'connected':
      return 'bg-success text-white';
    case 'live':
      return 'bg-info text-white';
    case 'disconnected':
      return 'bg-secondary text-white';
    case 'upgradeRequired':
      return 'bg-warning text-white';
    default:
      return 'bg-secondary text-white';
  }
});

const badgeText = computed(() => {
  switch (props.status) {
    case 'connected':
      return 'Connected';
    case 'live':
      return 'Live';
    case 'disconnected':
      return 'Disconnected';
    case 'upgradeRequired':
      return 'Upgrade Required';
    default:
      return 'Unknown';
  }
});

const tooltipText = computed(() => {
  let text = `${badgeText.value}`;

  if (props.organizationName) {
    text = `${props.organizationName}: ${text}`;
  }

  if (props.status === 'disconnected' && props.reason) {
    const reasonText = {
      upgradeRequired: 'Update required to reconnect',
      manual: 'Manually disconnected',
      error: 'Disconnected due to error',
      compatibilityConflict: 'Disconnected due to compatibility conflict',
    };
    text += ` - ${reasonText[props.reason]}`;
  }

  if (props.hasCompatibilityConflict) {
    text += ' - Has compatibility conflicts';
  }

  return text;
});

const showPulse = computed(() => {
  return props.status === 'live';
});
</script>

<template>
  <span
    :class="[
      'badge',
      badgeClass,
      'd-inline-flex',
      'align-items-center',
      'rounded',
      'py-3',
      'px-3',
      { pulse: showPulse },
    ]"
    :title="tooltipText"
    data-testid="connection-status-badge"
  >
    <i
      v-if="hasCompatibilityConflict"
      class="bi bi-exclamation-triangle-fill me-3"
      title="Compatibility conflict detected"
    ></i>
    <i
      v-else-if="status === 'connected' || status === 'live'"
      class="bi bi-check-circle-fill me-3"
    ></i>
    <i v-else-if="status === 'upgradeRequired'" class="bi bi-exclamation-circle-fill me-3"></i>
    <i v-else-if="status === 'disconnected'" class="bi bi-x-circle-fill me-3"></i>
    <span class="text-micro">{{ badgeText }}</span>
  </span>
</template>
