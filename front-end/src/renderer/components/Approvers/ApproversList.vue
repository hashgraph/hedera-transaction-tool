<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces/organization/approvers';

import { computed, nextTick, ref } from 'vue';

import useContactsStore from '@renderer/stores/storeContacts';

import AppButton from '@renderer/components/ui/AppButton.vue';
import ApproverModal from '@renderer/components/Approvers/ApproverModal.vue';

/* Props */
const props = withDefaults(
  defineProps<{
    approvers: TransactionApproverDto[];
    editable: boolean;
  }>(),
  {
    editable: false,
  },
);

/* Emits */
const emit = defineEmits(['update:approvers']);

/* Stores */
const contacts = useContactsStore();

/* State */
const selectedApproverIndex = ref(-1);
const approverModalShown = ref(false);
const approverModalRef = ref<InstanceType<typeof ApproverModal> | null>(null);

/* Computed */
const selectedApprover = computed(() => props.approvers[selectedApproverIndex.value] || null);

/* Handlers */
const handleAddNew = async () => {
  selectedApproverIndex.value = -1;
  await approverModalRef.value?.addNew();
};

const handleRemoveApprover = (index: number) => {
  emit(
    'update:approvers',
    props.approvers.filter((_, i) => i !== index),
  );

  selectedApproverIndex.value = -1;
};

const handleStartEditApprover = async (index: number, event: Event) => {
  event.stopPropagation();
  selectedApproverIndex.value = index;
  await approverModalRef.value?.startEdit();
};

const handleViewSummary = async (index: number, event: Event) => {
  event.stopPropagation();
  selectedApproverIndex.value = index;
  await approverModalRef.value?.viewSummary();
};

const handleApproversUpdate = async (approvers: TransactionApproverDto[]) => {
  for (const approver of approvers) {
    await nextTick();

    if (
      selectedApproverIndex.value > -1 &&
      getApproverIdFromThreshold(approver) &&
      props.approvers.some(app => app.userId === getApproverIdFromThreshold(approver))
    ) {
      emit(
        'update:approvers',
        props.approvers.filter((_, i) => i !== selectedApproverIndex.value),
      );
      selectedApproverIndex.value = -1;
      continue;
    }

    if (
      (typeof approver.userId === 'number' &&
        props.approvers.some(app => app.userId === approver.userId)) ||
      (getApproverIdFromThreshold(approver) &&
        props.approvers.some(app => app.userId === getApproverIdFromThreshold(approver)))
    ) {
      selectedApproverIndex.value = -1;
      continue;
    }
    if (selectedApproverIndex.value === -1) {
      emit('update:approvers', [...props.approvers, approver]);
    } else {
      emit(
        'update:approvers',
        props.approvers.map((a, i) => (i === selectedApproverIndex.value ? approver : a)),
      );
    }
  }

  selectedApproverIndex.value = -1;
};

/* Functions */
function getApproverIdFromThreshold(approver: TransactionApproverDto) {
  if (Array.isArray(approver.approvers) && approver.approvers.length === 1) {
    return getApproverIdFromThreshold(approver.approvers[0]);
  } else if (approver.userId) {
    return approver.userId;
  } else {
    return null;
  }
}
</script>
<template>
  <div>
    <div v-if="editable">
      <AppButton
        :color="'borderless'"
        :size="'small'"
        type="button"
        data-testid="button-add-approver"
        class="text-small min-w-unset"
        @click="handleAddNew"
        ><span class="bi bi-plus-lg"></span> Add</AppButton
      >
    </div>
    <div class="mt-3">
      <ul class="d-flex flex-wrap gap-3">
        <template v-for="(approver, i) in approvers" :key="i">
          <li class="text-center badge-bg rounded py-2 px-3">
            <p class="text-small text-nowrap">
              <span
                v-if="editable"
                class="bi bi-x-lg text-micro cursor-pointer me-2"
                @click="handleRemoveApprover(i)"
              ></span>
              <template v-if="approver.userId">
                {{ contacts.getContact(approver.userId)?.user.email || `User: ${approver.userId}` }}
                <span v-if="contacts.getNickname(approver.userId).trim().length > 0"
                  >({{ contacts.getNickname(approver.userId) }})
                </span>
              </template>
              <template v-else>
                <span
                  v-if="editable"
                  class="bi bi-pencil text-micro cursor-pointer me-2"
                  @click="handleStartEditApprover(i, $event)"
                ></span>
                <span
                  v-if="!editable"
                  class="bi bi-eye text-micro cursor-pointer me-2"
                  @click="handleViewSummary(i, $event)"
                ></span>
                <span>Approver structure #{{ i }}</span>
              </template>
            </p>
          </li>
        </template>
      </ul>
    </div>
    <ApproverModal
      ref="approverModalRef"
      :approver="selectedApprover"
      :on-close="() => (selectedApproverIndex = -1)"
      v-model:show="approverModalShown"
      @update:approvers="handleApproversUpdate"
    />
  </div>
</template>
