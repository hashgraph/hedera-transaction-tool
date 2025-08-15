<script setup lang="ts">
import type { ITransactionApprover } from '@shared/interfaces/organization/approvers';

import { computed, ref } from 'vue';

import useContactsStore from '@renderer/stores/storeContacts';

import { isApproved } from '@renderer/utils';

import ApproverStructureStatusModal from '@renderer/components/Approvers/ApproverStructureStatusModal.vue';

/* Props */
const props = defineProps<{
  approvers: ITransactionApprover[];
}>();

/* Stores */
const contacts = useContactsStore();

/* State */
const selectedApproverIndex = ref(-1);
const approverModalShown = ref(false);

/* Computed */
const selectedApprover = computed(() => props.approvers[selectedApproverIndex.value] || null);

/* Handlers */
const handleViewSummary = (index: number) => {
  selectedApproverIndex.value = index;
  approverModalShown.value = true;
};
</script>
<template>
  <div>
    <div class="mt-3">
      <ul class="d-flex flex-wrap gap-3">
        <template v-for="(approver, i) in approvers" :key="i">
          <li
            class="text-center badge-bg rounded py-2 px-3"
            :class="{
              'bg-success': isApproved(approver) === true,
              'bg-danger': isApproved(approver) === false,
            }"
          >
            <p
              class="text-small text-nowrap"
              :class="{
                'text-white': isApproved(approver) === false || isApproved(approver) === true,
              }"
            >
              <template v-if="approver.userId">
                {{ contacts.getContact(approver.userId)?.user.email || `User: ${approver.userId}` }}
                <span v-if="contacts.getNickname(approver.userId).trim().length > 0"
                  >({{ contacts.getNickname(approver.userId) }})
                </span>
              </template>
              <template v-else>
                <span
                  class="bi bi-eye text-micro cursor-pointer me-2"
                  @click="handleViewSummary(i)"
                ></span>
                <span>Approver structure #{{ i }}</span>
              </template>
            </p>
          </li>
        </template>
      </ul>
    </div>
    <ApproverStructureStatusModal
      v-if="approverModalShown"
      v-model:show="approverModalShown"
      :approver="selectedApprover"
    />
  </div>
</template>
