<script setup lang="ts">
import type { ITransactionFull } from '@main/shared/interfaces';

import { computed } from 'vue';

import { TransactionStatus } from '@main/shared/interfaces';

import AppStepper from '@renderer/components/ui/AppStepper.vue';

/* Props */
const props = defineProps<{
  transaction: ITransactionFull;
}>();

/* Computed */
const stepperItems = computed(() => {
  const items: {
    title: string;
    name: string;
    bubbleClass?: string;
    bubbleLabel?: string;
    bubbleIcon?: string;
  }[] = [
    { title: 'Transaction Created', name: 'Transaction Created' },
    { title: 'Collecting Signatures', name: 'Collecting Signatures' },
    { title: 'Awaiting Execution', name: 'Awaiting Execution' },
  ];

  if ([TransactionStatus.EXPIRED, TransactionStatus.CANCELED].includes(props.transaction.status)) {
    items.push({
      title: props.transaction.status === TransactionStatus.EXPIRED ? 'Expired' : 'Canceled',
      name: props.transaction.status === TransactionStatus.EXPIRED ? 'Expired' : 'Canceled',
      bubbleClass: 'bg-danger text-white',
      bubbleIcon: 'x-lg',
    });
    items[0].bubbleIcon = 'check-lg';
    items[1].bubbleIcon = 'check-lg';
    items.splice(2, 1);
  } else items.push({ title: 'Executed', name: 'Executed' });

  return items;
});

const stepperActiveIndex = computed(() => {
  switch (props.transaction.status) {
    case TransactionStatus.NEW:
      return 0;
    case TransactionStatus.WAITING_FOR_SIGNATURES:
      return 1;
    case TransactionStatus.WAITING_FOR_EXECUTION:
      return 2;
    case TransactionStatus.EXECUTED:
    case TransactionStatus.FAILED:
      return 3;
    default:
      return -1;
  }
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
</script>
<template>
  <h4 :class="detailItemLabelClass">Transaction Status</h4>
  <AppStepper
    :items="stepperItems"
    :active-index="
      stepperActiveIndex === stepperItems.length - 1 ? stepperActiveIndex + 1 : stepperActiveIndex
    "
  />
</template>
