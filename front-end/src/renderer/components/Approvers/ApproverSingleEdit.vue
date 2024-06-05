<script setup lang="ts">
import { ref } from 'vue';

import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import useContactsStore from '@renderer/stores/storeContacts';

import AppButton from '@renderer/components/ui/AppButton.vue';
import UserSelectModal from '@renderer/components/Organization/UserSelectModal.vue';

/* Props */
defineProps<{
  modelApprover: TransactionApproverDto | null;
}>();

/* Emits */
const emit = defineEmits(['update:modelApprover']);

/* Stores */
const contacts = useContactsStore();

/* State */
const selectUserModalShown = ref(false);

/* Handlers */
const handleUserSelect = (userIds: number[]) => {
  emit('update:modelApprover', { userId: userIds[0] });
  selectUserModalShown.value = false;
};

const handleRemoveUser = () => {
  emit('update:modelApprover', {});
};
</script>
<template>
  <div>
    <div class="text-center">
      <AppButton color="secondary" type="button" @click="selectUserModalShown = true"
        >Select User</AppButton
      >
    </div>
    <div
      v-if="modelApprover?.userId"
      class="key-threshhold-bg d-flex justify-content-between rounded py-3 px-4 mt-5"
    >
      <div>
        {{
          contacts.getContact(modelApprover.userId)?.user.email || `User: ${modelApprover.userId}`
        }}
        <span v-if="contacts.getNickname(modelApprover.userId).trim().length > 0">
          ({{ contacts.getNickname(modelApprover.userId) }})
        </span>
      </div>
      <div class="text-small">
        <span
          class="bi bi-x-lg cursor-pointer"
          @click="handleRemoveUser"
          :data-testid="`button-approver-signgle-edit-remove-element`"
        ></span>
      </div>
    </div>
    <UserSelectModal
      v-if="selectUserModalShown"
      v-model:show="selectUserModalShown"
      @users-selected="handleUserSelect"
    />
  </div>
</template>
