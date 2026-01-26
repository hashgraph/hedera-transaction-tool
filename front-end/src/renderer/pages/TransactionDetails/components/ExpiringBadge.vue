<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';

import { TransactionStatus } from '@shared/interfaces';

/* Constants */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_SECOND_MS = 1000;

/* Props */
const props = withDefaults(
  defineProps<{
    validStart: Date | null;
    validDuration: number; // Duration in seconds
    transactionStatus: TransactionStatus | null;
    /**
     * Badge variant:
     * - 'simple': Shows "Expiring soon" text
     * - 'countdown': Shows "Expires in HHh MMm" (>= 1h) or "Expires in MMm SSs" (< 1h) with live countdown
     *
     * To switch variants, change this prop value.
     * To remove the feature entirely, delete this component and its usage.
     */
    variant?: 'simple' | 'countdown';
  }>(),
  {
    variant: 'simple',
  },
);

/* State */
const now = ref(Date.now());
let intervalId: ReturnType<typeof setInterval> | null = null;
let currentIntervalMs: number | null = null;

/* Computed */
const inProgressStatuses = [
  TransactionStatus.NEW,
  TransactionStatus.WAITING_FOR_SIGNATURES,
  TransactionStatus.WAITING_FOR_EXECUTION,
];

const timeUntilExpiry = computed(() => {
  if (!props.validStart) return null;
  const expiryTime = props.validStart.getTime() + props.validDuration * 1000;
  return expiryTime - now.value;
});

const shouldShowBadge = computed(() => {
  if (!props.validStart) return false;
  if (!props.transactionStatus || !inProgressStatuses.includes(props.transactionStatus)) {
    return false;
  }
  const remaining = timeUntilExpiry.value;
  return remaining !== null && remaining > 0 && remaining <= TWENTY_FOUR_HOURS_MS;
});

const currentInterval = computed(() => {
  const remaining = timeUntilExpiry.value;

  // No interval needed if badge won't show or time expired
  if (remaining === null || remaining <= 0 || !shouldShowBadge.value) {
    return null;
  }

  // Under 1 hour: update every second for MMm SSs format
  if (remaining < ONE_HOUR_MS) {
    return ONE_SECOND_MS;
  }

  // 1 hour or more: update every minute for HHh MMm format
  return ONE_MINUTE_MS;
});

const countdownText = computed(() => {
  const remaining = timeUntilExpiry.value;

  if (!remaining || remaining <= 0) {
    return 'Expired';
  }

  const totalSeconds = Math.floor(remaining / ONE_SECOND_MS);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Under 1 hour: show MMm SSs format (updates every second)
  if (remaining < ONE_HOUR_MS) {
    return `Expires in ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  // 1 hour or more: show HHh MMm format (updates every minute)
  return `Expires in ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
});

/* Functions - Interval management */
function clearCurrentInterval() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    currentIntervalMs = null;
  }
}

function setupInterval() {
  // Only setup interval for countdown variant
  if (props.variant !== 'countdown') {
    return;
  }

  const targetInterval = currentInterval.value;

  // No interval needed (expired or badge not showing)
  if (targetInterval === null) {
    clearCurrentInterval();
    return;
  }

  // Interval already running at correct rate - no change needed
  if (currentIntervalMs === targetInterval) {
    return;
  }

  // Clear existing interval and setup new one at the target rate
  clearCurrentInterval();

  currentIntervalMs = targetInterval;
  intervalId = setInterval(() => {
    now.value = Date.now();
  }, targetInterval);
}

/* Lifecycle */
onMounted(() => {
  setupInterval();
});

onUnmounted(() => {
  clearCurrentInterval();
});

/* Watcher - Adjust interval when time tier changes */
watch(currentInterval, () => {
  setupInterval();
});
</script>

<template>
  <span v-if="shouldShowBadge" class="badge bg-danger text-break ms-2">
    <!-- VARIANT: Simple text badge -->
    <template v-if="variant === 'simple'">Expiring soon</template>

    <!-- VARIANT: Countdown badge -->
    <template v-else-if="variant === 'countdown'">{{ countdownText }}</template>
  </span>
</template>
