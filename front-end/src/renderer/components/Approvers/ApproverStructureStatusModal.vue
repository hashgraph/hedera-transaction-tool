<script setup lang="ts">
import { ITransactionApprover } from '@main/shared/interfaces/organization/approvers';

import AppModal from '@renderer/components/ui/AppModal.vue';
import ApproverStructureStatus from '@renderer/components/Approvers/ApproverStructureStatus.vue';

/* Props */
defineProps<{
  approver: ITransactionApprover;
  show: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Handlers */
const handleShowUpdate = show => emit('update:show', show);
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="modal-fit-content">
    <div class="p-5">
      <ApproverStructureStatus :approver="approver" />
    </div>
  </AppModal>
</template>
