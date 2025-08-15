<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces/organization/approvers';

import { computed, ref } from 'vue';

import useContactsStore from '@renderer/stores/storeContacts';

import AppButton from '@renderer/components/ui/AppButton.vue';
import UserSelectModal from '@renderer/components/Organization/UserSelectModal.vue';

/* Props */
const props = defineProps<{
  modelApprovers: TransactionApproverDto[] | null;
}>();

/* Emits */
const emit = defineEmits(['update:modelApprover']);

/* Stores */
const contacts = useContactsStore();

/* State */
const selectUserModalShown = ref(false);

/* Computed */
const alreadyAddedUserIds = computed<number[]>(() =>
  props.modelApprovers === null
    ? []
    : (props.modelApprovers
        ?.filter(approver => approver.userId !== undefined)
        .map(approver => approver.userId) as number[]) || [],
);

/* Handlers */
const handleUserSelect = (userIds: number[]) => {
  const filteredUserIds = userIds.filter(userId => !alreadyAddedUserIds.value.includes(userId));
  emit(
    'update:modelApprover',
    (props.modelApprovers || []).concat(
      filteredUserIds.map(userId => ({
        userId,
        approverType: 'Single',
      })),
    ),
  );
  selectUserModalShown.value = false;
};

const handleRemoveUser = (index: number) => {
  const newApprovers = props.modelApprovers?.filter((_, i) => i !== index) || [];
  emit('update:modelApprover', newApprovers.length > 0 ? newApprovers : null);
};
</script>
<template>
  <div>
    <div class="text-center">
      <AppButton
        color="secondary"
        data-testid="button-select-user"
        type="button"
        @click="selectUserModalShown = true"
        >Select User</AppButton
      >
    </div>
    <template v-for="(approver, _i) in modelApprovers || []" :key="`${approver?.userId}${_i}`">
      <div
        v-if="approver?.userId"
        class="key-threshhold-bg d-flex justify-content-between rounded py-3 px-4 mt-5"
      >
        <div>
          {{ contacts.getContact(approver.userId)?.user.email || `User: ${approver.userId}` }}
          <span v-if="contacts.getNickname(approver.userId).trim().length > 0">
            ({{ contacts.getNickname(approver.userId) }})
          </span>
        </div>
        <div class="text-small">
          <span
            class="bi bi-x-lg cursor-pointer"
            @click="handleRemoveUser(_i)"
            :data-testid="`button-approver-signgle-edit-remove-element`"
          ></span>
        </div>
      </div>
    </template>

    <UserSelectModal
      v-if="selectUserModalShown"
      v-model:show="selectUserModalShown"
      :mulitple="true"
      :already-added="alreadyAddedUserIds"
      @users-selected="handleUserSelect"
    />
  </div>
</template>
