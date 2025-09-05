<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces/organization/approvers';

import { onMounted, ref } from 'vue';

import ApproverThreshold from '@renderer/components/Approvers/ApproverThreshold.vue';

/* Props */
const props = defineProps<{
  modelApprover: TransactionApproverDto | null;
}>();

/* Emits */
const emit = defineEmits(['update:modelApprover']);

/* State */
const transactionApprover = ref<TransactionApproverDto>({});

/* Handlers */
const handleKeyListChange = (newApprover: TransactionApproverDto) => {
  emit('update:modelApprover', newApprover);
};

const handleKeyListRemove = () => {
  emit('update:modelApprover', {});
  transactionApprover.value = {};
};

/* Hooks */
onMounted(() => {
  if (props.modelApprover?.approvers) {
    transactionApprover.value = props.modelApprover;
  }
});
</script>
<template>
  <ApproverThreshold
    v-model:approver="transactionApprover"
    @update:approver="handleKeyListChange"
    :on-remove-approver="handleKeyListRemove"
    :depth="'0'"
  />
</template>
