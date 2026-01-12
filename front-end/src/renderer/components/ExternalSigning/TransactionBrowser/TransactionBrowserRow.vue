<script setup lang="ts">
import { computed } from 'vue';
import { Transaction } from '@hashgraph/sdk';
import type { ITransactionBrowserItem } from './ITransactionBrowserItem';
import TransactionId from '@renderer/components/ui/TransactionId.vue';
import DateTimeString from '@renderer/components/ui/DateTimeString.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { hexToUint8Array } from '@renderer/utils';
import { getTransactionType, getTransactionValidStart } from '@renderer/utils/sdk/transactions.ts';

/* Props */
const props = defineProps<{
  item: ITransactionBrowserItem;
  index: number;
}>();

/* Emits */
const emit = defineEmits(['details']);

/* Computed */
const transaction = computed(() => {
  return Transaction.fromBytes(hexToUint8Array(props.item.transactionBytes));
});
const transactionId = computed(() => transaction.value?.transactionId);
const transactionType = computed(() => {
  return getTransactionType(transaction.value, false, true);
});
const description = computed(() => props.item.description ?? '');
const validStartDate = computed(() => {
  return getTransactionValidStart(transaction.value);
});
const creatorEmail = computed(() => props.item.creatorEmail ?? '');

function handleDetails() {
  emit('details', props.index);
}
</script>

<template>
  <tr>
    <td>
      <TransactionId v-if="transactionId" :transaction-id="transactionId" wrap />
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
