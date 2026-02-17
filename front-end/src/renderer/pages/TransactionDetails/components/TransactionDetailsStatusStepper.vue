<script setup lang="ts">
import type { ITransactionFull } from '@shared/interfaces';

import { computed } from 'vue';

import { TransactionStatus } from '@shared/interfaces';

import AppStepper from '@renderer/components/ui/AppStepper.vue';

/* Props */
const props = defineProps<{
  transaction: ITransactionFull;
}>();

/* Computed */
const hasApproveStep = computed(() => {
  return props.transaction.approvers.length > 0;
});

const stepperItems = computed(() => {
  const items: {
    title: string;
    name: string;
    bubbleClass?: string;
    bubbleLabel?: string;
    bubbleIcon?: string;
  }[] = [{ title: 'Transaction Created', name: 'Transaction Created' }];

  // If rejected, add rejected step and return
  if (props.transaction.status === TransactionStatus.REJECTED) {
    items.push(createErrorItem('Rejected', 'Rejected'));
    return items;
  }

  if (hasApproveStep.value) {
    items.push({ title: 'Awaiting Approval', name: 'Awaiting Approval' });
  }

  items.push({ title: 'Collecting Signatures', name: 'Collecting Signatures' });

  // If expired or canceled, add those steps and return
  if (props.transaction.status === TransactionStatus.EXPIRED) {
    items.push(createErrorItem('Expired', 'Expired'));
    return items;
  }

  if (props.transaction.status === TransactionStatus.CANCELED) {
    items.push(createErrorItem('Canceled', 'Canceled'));
    return items;
  }

  if (props.transaction.status === TransactionStatus.ARCHIVED) {
    items.push(createSuccessItem('Archived', 'Archived'));
    return items;
  }

  if (props.transaction.isManual) {
    items.push({ title: 'Ready for Execution', name: 'Ready for Execution' });
  } else {
    items.push({ title: 'Awaiting Execution', name: 'Awaiting Execution' });
  }

  if (props.transaction.status === TransactionStatus.FAILED) {
    items.push(createErrorItem('Failed', 'Failed'));
    return items;
  }

  items.push(createSuccessItem('Executed', 'Executed'));

  return items;
});

// Active index is the index of the last step that has been completed. If the status is a
// failed type status (ex. REJECTED, EXPIRED, FAILED, CANCELED), the active index is -1 in order
// to show the last step as failed.
const stepperActiveIndex = computed(() => {
  switch (props.transaction.status) {
    case TransactionStatus.NEW:
      return 0;
    case TransactionStatus.REJECTED:
      // case TransactionStatus.WAITING_FOR_APPROVAL:
      return 1;
    case TransactionStatus.WAITING_FOR_SIGNATURES:
      return hasApproveStep.value ? 2 : 1;
    case TransactionStatus.EXPIRED:
    case TransactionStatus.CANCELED:
    case TransactionStatus.WAITING_FOR_EXECUTION:
    case TransactionStatus.ARCHIVED:
      return hasApproveStep.value ? 3 : 2;
    case TransactionStatus.EXECUTED:
    case TransactionStatus.FAILED:
      return hasApproveStep.value ? 4 : 3;
    default:
      return -1;
  }
});

/* Functions */
const createSuccessItem = (title: string, name: string) => {
  return {
    title,
    name,
    bubbleClass: 'bg-success text-white',
  };
};

const createErrorItem = (title: string, name: string) => {
  return {
    title,
    name,
    bubbleClass: 'bg-danger text-white',
    bubbleIcon: 'x-lg',
  };
};

</script>
<template>
  <AppStepper :items="stepperItems" :active-index="stepperActiveIndex" />
</template>
