<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { type ITransactionFull, TransactionStatus, TransactionTypeName } from '@shared/interfaces';
import type { IGroupItem } from '@renderer/services/organization/transactionGroup';
import { formatTransactionType } from '@renderer/utils/sdk/transactions.ts';
import AppButton from '@renderer/components/ui/AppButton.vue';
import DateTimeString from '@renderer/components/ui/DateTimeString.vue';
import TransactionId from '@renderer/components/ui/TransactionId.vue';
import {
  assertIsLoggedInOrganization,
  getStatusFromCode,
  isSignableTransaction,
} from '@renderer/utils';
import useUserStore from '@renderer/stores/storeUser.ts';
import useNetwork from '@renderer/stores/storeNetwork.ts';
import { AppCache } from '@renderer/caches/AppCache.ts';
import useRevealed from '@renderer/composables/useRevealed.ts';
import SignSingleButton from '@renderer/pages/Transactions/components/SignSingleButton.vue';

/* Props */
const props = defineProps<{
  groupItem: IGroupItem;
  rowIndex: number;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'handleDetails', transactionId: number): Promise<void>;
  (event: 'transactionSigned', transaction: ITransactionFull): void;
}>();

/* Injected */
const appCache = AppCache.inject();

/* Stores */
const user = useUserStore();
const network = useNetwork();

/* State */
const canSign = ref(false);
const container = ref<HTMLElement | null>(null);

/* Computed */
const itemStatusBadgeClass = computed((): string => {
  let result: string;
  const status = props.groupItem.transaction.status;
  const statusCode = props.groupItem.transaction.statusCode;
  if (statusCode) {
    result = [0, 22, 104].includes(statusCode) ? 'bg-success' : 'bg-danger';
  } else {
    switch (status) {
      case TransactionStatus.WAITING_FOR_EXECUTION:
        result = 'bg-success-subtle text-success-emphasis border border-success-subtle';
        break;
      case TransactionStatus.ARCHIVED:
        result = 'bg-success';
        break;
      case TransactionStatus.EXPIRED:
      case TransactionStatus.CANCELED:
      case TransactionStatus.REJECTED:
        result = 'bg-danger';
        break;
      case TransactionStatus.WAITING_FOR_SIGNATURES:
        result = canSign.value ? 'bg-info' : 'text-muted';
        break;
      default:
        result = 'text-muted';
    }
  }
  return result;
});

const itemStatusLabel = computed((): string => {
  let result: string;
  const status = props.groupItem.transaction.status;
  const statusCode = props.groupItem.transaction.statusCode;

  if (statusCode) {
    // Transaction has been executed
    result = getStatusFromCode(statusCode) ?? '';
  } else {
    switch (status) {
      case TransactionStatus.WAITING_FOR_SIGNATURES:
        result = canSign.value ? 'READY TO SIGN' : 'IN PROGRESS';
        break;
      case TransactionStatus.WAITING_FOR_EXECUTION:
        result = 'READY FOR EXECUTION';
        break;
      case TransactionStatus.EXECUTED:
        result = 'EXECUTED';
        break;
      case TransactionStatus.CANCELED:
        result = 'CANCELED';
        break;
      case TransactionStatus.EXPIRED:
        result = 'EXPIRED';
        break;
      case TransactionStatus.REJECTED:
        result = 'REJECTED';
        break;
      case TransactionStatus.ARCHIVED:
        result = 'ARCHIVED';
        break;
      default:
        result = status;
    }
  }
  return result;
});

const transactionType = computed(() => {
  const typeName = TransactionTypeName[props.groupItem.transaction.type];
  return formatTransactionType(typeName, false, true);
});

/* Functions */
const updateSigningStatus = async (): Promise<void> => {
  canSign.value = false;
  const tx = props.groupItem.transaction;
  try {
    assertIsLoggedInOrganization(user.selectedOrganization);
    canSign.value = await isSignableTransaction(
      tx,
      network.mirrorNodeBaseURL,
      appCache,
      user.selectedOrganization,
    );
  } catch {
    canSign.value = false;
  }
};

/* Hooks */
useRevealed(container, () => {
  watch(
    [() => props.groupItem.transaction.status, () => props.groupItem.transaction.transactionBytes],
    updateSigningStatus,
    { immediate: true },
  );
});
</script>

<template>
  <tr ref="container">
    <!-- Column #1 : Transaction ID -->
    <td data-testid="td-group-transaction-id">
      <TransactionId :transaction-id="props.groupItem.transaction.transactionId" wrap />
    </td>
    <!-- Column #2 : Transaction Type -->
    <td>
      <span class="text-bold">{{ transactionType }}</span>
    </td>
    <!-- Column #3 : Status -->
    <td :data-testid="`td-transaction-node-transaction-status-${props.rowIndex}`">
      <span :class="itemStatusBadgeClass" class="badge text-break">{{ itemStatusLabel }}</span>
    </td>
    <!-- Column #4 : Valid Start -->
    <td data-testid="td-group-valid-start-time">
      <DateTimeString :date="new Date(groupItem.transaction.validStart)" compact wrap />
    </td>
    <!-- Column #5 : Actions -->
    <td class="text-center">
      <div class="d-flex justify-content-center gap-4">
        <SignSingleButton
          :disabled="!canSign"
          :refresh-transaction="true"
          :transaction-id="props.groupItem.transactionId"
          @transactionSigned="payload => emit('transactionSigned', payload.transaction)"
        />
        <AppButton
          :data-testid="`button-group-transaction-${props.rowIndex}`"
          color="secondary"
          type="button"
          @click.prevent="() => emit('handleDetails', props.groupItem.transactionId)"
          ><span>Details</span>
        </AppButton>
      </div>
    </td>
  </tr>
</template>

<style scoped></style>
