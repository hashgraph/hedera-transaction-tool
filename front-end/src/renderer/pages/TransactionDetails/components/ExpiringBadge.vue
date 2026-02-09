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
     * - 'simple': Shows "Expiring soon" or "Expired" text
     * - 'countdown': Shows "Expires in HHh MMm" / "Expires in MMm SSs" (active)
     *                or "Expired" / "Expired HHh MMm ago" (expired) with live countdown
     *
     * Note: Expired transactions show "Expired" state until backend notifies
     * and updates the transaction status.
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
];

const timeUntilExpiry = computed(() => {
  if (!props.validStart) return null;
  const expiryTime = props.validStart.getTime() + props.validDuration * 1000;
  return expiryTime - now.value;
});

const shouldShowBadge = computed(() => {
  // Must have valid start date
  if (!props.validStart || isNaN(props.validStart.getTime())) return false;

  // Must be in-progress status
  if (!props.transactionStatus || !inProgressStatuses.includes(props.transactionStatus)) {
    return false;
  }

  const remaining = timeUntilExpiry.value;
  if (remaining === null) return false;

  // Show badge when expiring within 24 hours OR when just expired
  // (badge will disappear when backend notifies and status changes to EXPIRED)
  return remaining <= TWENTY_FOUR_HOURS_MS;
});

const currentInterval = computed(() => {
  const remaining = timeUntilExpiry.value;

  // No interval needed if badge won't show
  if (remaining === null || !shouldShowBadge.value) {
    return null;
  }

  // After expiry: update every second to show "Expired X ago" (countdown) or "Expired" (simple)
  if (remaining <= 0) {
    return ONE_SECOND_MS;
  }

  // Simple variant: use 1 second interval to detect the expiry transition precisely
  if (props.variant === 'simple') {
    return ONE_SECOND_MS;
  }

  // Countdown variant: adaptive interval based on remaining time
  // Under 1 hour: update every second for MMm SSs format
  if (remaining < ONE_HOUR_MS) {
    return ONE_SECOND_MS;
  }

  // 1 hour or more: update every minute for HHh MMm format
  return ONE_MINUTE_MS;
});

const countdownText = computed(() => {
  const remaining = timeUntilExpiry.value;

  if (remaining === null) {
    return '';
  }

  if (remaining <= 0) {
    return 'Expired';
  }

  // ACTIVE: Show "Expires in HHh MMm" or "Expires in MMm SSs"
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

const simpleText = computed(() => {
  const remaining = timeUntilExpiry.value;
  if (remaining === null) return '';
  return remaining <= 0 ? 'Expired' : 'Expiring soon';
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
  const targetInterval = currentInterval.value;

  // No interval needed (badge not showing)
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

/* Watcher - Handle variant changes at runtime */
watch(() => props.variant, () => {
  setupInterval();
});
</script>

<template>
  <span
    v-if="shouldShowBadge"
    :class="[
      'badge',
      timeUntilExpiry! > 0 ? 'bg-warning' : 'bg-danger',
      'text-break',
    ]"
  >
    <!-- VARIANT: Simple text badge -->
    <template v-if="variant === 'simple'">{{ simpleText }}</template>

    <!-- VARIANT: Countdown badge -->
    <template v-else-if="variant === 'countdown'">{{ countdownText }}</template>
  </span>
</template>
