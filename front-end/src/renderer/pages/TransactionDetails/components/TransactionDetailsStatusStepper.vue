<script setup lang="ts">
import { ITransactionFull } from '@main/shared/interfaces';

import { computed } from 'vue';

import { TransactionStatus } from '@main/shared/interfaces';

import { getTransactionStatusName } from '@renderer/utils';

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
    { title: 'Executed', name: 'Executed' },
  ];

  if (
    [
      TransactionStatus.REJECTED,
      TransactionStatus.EXPIRED,
      TransactionStatus.FAILED,
      TransactionStatus.CANCELED,
      TransactionStatus.ARCHIVED
    ].includes(
      props.transaction.status,
    )
  ) {
    items.splice(2, 2);
  }

  if ([
    TransactionStatus.REJECTED,
    TransactionStatus.EXPIRED,
    TransactionStatus.FAILED,
    TransactionStatus.CANCELED
  ].includes(props.transaction.status)) {
    items[items.length] = {
      title: getTransactionStatusName(props.transaction.status),
      name: getTransactionStatusName(props.transaction.status),
      bubbleClass: 'bg-danger text-white',
      bubbleIcon: 'x-lg',
    };
  } else if ([TransactionStatus.ARCHIVED].includes(props.transaction.status)) {
    items.push({ title: 'Archived', name: 'Archived' });
  }

  return items;
});

// Active index is the index of the last step that has been completed. If the status is a
// failed type status (ex. REJECTED, EXPIRED, FAILED, CANCELED), the active index is -1 in order
// to show the last step as failed.
const stepperActiveIndex = computed(() => {
  switch (props.transaction.status) {
    case TransactionStatus.NEW:
      return 0;
    case TransactionStatus.WAITING_FOR_SIGNATURES:
      return 1;
    case TransactionStatus.WAITING_FOR_EXECUTION:
    case TransactionStatus.ARCHIVED:
      return 2;
    case TransactionStatus.EXECUTED:
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
