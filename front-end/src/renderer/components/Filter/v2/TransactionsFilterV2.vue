<script setup lang="ts">
import StatusFieldV2 from '@renderer/components/Filter/v2/StatusFieldV2.vue';
import TransactionTypeFilterV2 from '@renderer/components/Filter/v2/TransactionTypeFilterV2.vue';
import { BackEndTransactionType, TransactionStatus } from '@shared/interfaces';

/* Models */
const statusFilter = defineModel<TransactionStatus[]>('statusFilter', { required: true });
const transactionTypeFilter = defineModel<BackEndTransactionType[]>('transactionTypeFilter', {
  required: true,
});
</script>

<template>
  <div class="d-flex flex-wrap gap-4 text-small">
    <StatusFieldV2 v-model:status-filter="statusFilter" />
    <TransactionTypeFilterV2 v-model:transaction-type-filter="transactionTypeFilter" />
  </div>
</template>
