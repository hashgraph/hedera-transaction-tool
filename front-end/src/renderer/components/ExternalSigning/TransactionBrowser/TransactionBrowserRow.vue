<script setup lang="ts">
import { computed } from 'vue';
import type { TransactionBrowserEntry } from './TransactionBrowserEntry';
import TransactionId from '@renderer/components/ui/TransactionId.vue';
import DateTimeString from '@renderer/components/ui/DateTimeString.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { getTransactionType, getTransactionValidStart } from '@renderer/utils/sdk/transactions.ts';

/* Props */
const props = defineProps<{
  entry: TransactionBrowserEntry;
  index: number;
}>();

/* Emits */
const emit = defineEmits(['details']);

/* Computed */
const transaction = computed(() => {
  return props.entry.transaction;
});
const transactionId = computed(() => transaction.value?.transactionId);
const transactionType = computed(() => {
  return transaction.value
    ? getTransactionType(transaction.value, false, true)
    : 'Decoding failure';
});
const description = computed(() => props.entry.item.description ?? '');
const validStartDate = computed(() => {
  return transaction.value ? getTransactionValidStart(transaction.value) : null;
});
const creatorEmail = computed(() => props.entry.item.creatorEmail ?? '');

const fullySignedByUser = computed(() => props.entry.fullySignedByUser);

function handleDetails() {
  emit('details', props.index);
}
</script>

<template>
  <tr class="position-relative">
    <td>
      <span>
        <span
          v-if="fullySignedByUser"
          class="bi bi-check-lg text-success position-absolute"
          :style="{ left: '-16px' }"
        />
        <TransactionId v-if="transactionId" :transaction-id="transactionId" wrap />
      </span>
    </td>
    <td class="text-bold">
      {{ transactionType }}
    </td>
    <td>
      <span class="text-wrap-two-line-ellipsis">
        {{ description }}
      </span>
    </td>
    <td>
      <DateTimeString :date="validStartDate" compact wrap />
    </td>
    <td>{{ creatorEmail }}</td>
    <td>
      <AppButton
        :data-testid="`button-external-transaction-details-${props.index}`"
        color="secondary"
        type="button"
        @click="handleDetails"
      >
        Details
      </AppButton>
    </td>
  </tr>
</template>
