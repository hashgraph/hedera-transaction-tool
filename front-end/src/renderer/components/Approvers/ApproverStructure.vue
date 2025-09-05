<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces/organization/approvers';

import useContactsStore from '@renderer/stores/storeContacts';

/* Props */
defineProps<{
  approvers: TransactionApproverDto[];
}>();

/* Stores */
const contacts = useContactsStore();
</script>
<template>
  <template v-for="(approver, _i) in approvers" :key="`${approver?.userId}${_i}`">
    <div v-if="approver.approvers">
      <p>
        Threshold ({{ approver.threshold || approver.approvers.length }} of
        {{ approver.approvers.length }})
      </p>
      <template v-for="(item, _index) in approver.approvers" :key="_index">
        <template v-if="item.threshold || (item.approvers && item.approvers.length > 0)">
          <div class="ms-5">
            <ApproverStructure :approvers="[item]" />
          </div>
        </template>
        <template v-else-if="item.userId">
          <p class="ms-5">
            {{ contacts.getContact(item.userId)?.user.email || `User: ${item.userId}` }}
            <span v-if="contacts.getNickname(item.userId).trim().length > 0" class="text-pink"
              >({{ contacts.getNickname(item.userId) }})
            </span>
          </p>
        </template>
      </template>
    </div>
    <div v-else-if="approver.userId">
      <p class="ms-5">
        {{ contacts.getContact(approver.userId)?.user.email || `User: ${approver.userId}` }}
        <span v-if="contacts.getNickname(approver.userId).trim().length > 0" class="text-pink">
          ({{ contacts.getNickname(approver.userId) }})
        </span>
      </p>
    </div>
  </template>
</template>
