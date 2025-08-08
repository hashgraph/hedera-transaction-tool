<script setup lang="ts">
import type { ITransactionApprover } from '@shared/interfaces/organization/approvers';

import useContactsStore from '@renderer/stores/storeContacts';

import { isApproved } from '@renderer/utils';

/* Props */
defineProps<{
  approver: ITransactionApprover;
}>();

/* Stores */
const contacts = useContactsStore();
</script>
<template>
  <div v-if="Array.isArray(approver.approvers)">
    <p>
      <span v-if="isApproved(approver) === true" class="bi bi-check-lg text-success"></span>
      <span v-if="isApproved(approver) === false" class="bi bi-x-lg text-danger"></span>
      Threshold ({{
        !approver.threshold || approver.threshold === approver.approvers.length
          ? approver.approvers.length
          : approver.threshold
      }}
      of {{ (approver.approvers || []).length }})
    </p>
    <template v-for="(item, _index) in approver.approvers" :key="_index">
      <template v-if="Array.isArray(item.approvers)">
        <div class="ms-5">
          <ApproverStructureStatus :approver="item" :public-keys-signed="item" />
        </div>
      </template>
      <template v-else-if="typeof item.userId === 'number'">
        <p class="ms-5 my-3">
          <span v-if="isApproved(item) === true" class="bi bi-check-lg text-success me-2"></span>
          <span v-if="isApproved(item) === false" class="bi bi-x-lg text-danger me-2"></span>
          {{ contacts.getContact(item.userId)?.user.email || `User: ${item.userId}` }}
          <span v-if="contacts.getNickname(item.userId).trim().length > 0">
            ({{ contacts.getNickname(item.userId) }})
          </span>
        </p>
      </template>
    </template>
  </div>
</template>
