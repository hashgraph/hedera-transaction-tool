<script lang="ts" setup>
import { computed } from 'vue';
import { TransactionId } from '@hashgraph/sdk';

/* Props */
const props = withDefaults(
  defineProps<{
    transactionId: TransactionId | string | null;
    wrap: boolean;
  }>(),
  {
    wrap: false,
  },
);

/* Computed */
const tid = computed(() => {
  let result: TransactionId | null;
  if (typeof props.transactionId === 'string') {
    result = TransactionId.fromString(props.transactionId);
  } else if (props.transactionId instanceof TransactionId) {
    result = props.transactionId;
  } else {
    result = null;
  }
  return result;
});
const accountId = computed(() => tid.value?.accountId);
const timestamp = computed(() => tid.value?.validStart);
const validId = computed(() => accountId.value != null && timestamp.value != null);
</script>

<template>
  <span v-if="validId" data-testid="transaction-id" style="white-space: nowrap">
    <template v-if="props.wrap">
      {{ accountId }}<wbr /><span class="text-body-tertiary">@{{ timestamp }}</span>
    </template>
    <template v-else>
      {{ accountId }}<span class="text-body-tertiary">@{{ timestamp }}</span>
    </template>
  </span>
  <span v-else>-</span>
</template>
