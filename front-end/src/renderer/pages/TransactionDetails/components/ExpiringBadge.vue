<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';

import { TransactionStatus } from '@shared/interfaces';

/* Constants */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

/* Props */
const props = withDefaults(
  defineProps<{
    validStart: Date | null;
    validDuration: number; // Duration in seconds
    transactionStatus: TransactionStatus | null;
    /**
     * Badge variant:
     * - 'simple': Shows "Expiring soon" text
     * - 'countdown': Shows "Expires in HH:MM" with live countdown
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

const countdownText = computed(() => {
  if (!timeUntilExpiry.value || timeUntilExpiry.value <= 0) return '';

  const totalMinutes = Math.floor(timeUntilExpiry.value / ONE_MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `Expires in ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

/* Lifecycle - Only start interval for countdown variant */
onMounted(() => {
  if (props.variant === 'countdown') {
    intervalId = setInterval(() => {
      now.value = Date.now();
    }, ONE_MINUTE_MS);
  }
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
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
