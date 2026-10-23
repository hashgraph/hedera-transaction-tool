<script setup lang="ts">
import { ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertIsLoggedInOrganization,
  getGroupCreatorSignatureStatus,
  snapshotGroup,
  type CreatorSignatureStatus,
} from '@renderer/utils';
import { getTransactionGroupById, type IGroup } from '@renderer/services/organization';
import AppButton from '@renderer/components/ui/AppButton.vue';
import CreatorSignatureConfirmModal from '@renderer/components/CreatorSignatureConfirmModal.vue';
import SignAllController from '@renderer/pages/TransactionGroupDetails/SignAllController.vue';

/* Props */
const props = defineProps<{
  groupId: number;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transactionGroupSigned', payload: { groupId: number; signed: boolean }): void;
}>();

/* Stores */
const user = useUserStore();

/* State */
const signAllStarted = ref<boolean>(false);
const showUnverifiedConfirm = ref(false);
const creatorSignatureStatus = ref<CreatorSignatureStatus>('verified');
const group = ref<IGroup | null>(null);

/* Handlers */
const handleClick = async () => {
  assertIsLoggedInOrganization(user.selectedOrganization);

  group.value = snapshotGroup(
    await getTransactionGroupById(user.selectedOrganization.serverUrl, props.groupId),
  );
  creatorSignatureStatus.value = getGroupCreatorSignatureStatus(
    group.value,
    user.selectedOrganization.userKeys,
  );

  if (creatorSignatureStatus.value === 'verified') {
    signAllStarted.value = true;
  } else {
    showUnverifiedConfirm.value = true;
  }
};

const didSignAll = async (groupId: number, signed: boolean) => {
  if (!signed) return;

  emit('transactionGroupSigned', { groupId, signed });
};
</script>

<template>
  <AppButton
    v-bind="$attrs"
    loading-text="Sign All"
    color="primary"
    type="button"
    @click.prevent="handleClick"
  >
    Sign All
  </AppButton>

  <CreatorSignatureConfirmModal
    v-model:show="showUnverifiedConfirm"
    group
    :status="creatorSignatureStatus"
    :callback="() => (signAllStarted = true)"
  />
  <SignAllController
    v-model:activate="signAllStarted"
    :groupOrId="group ?? props.groupId"
    :callback="didSignAll"
  />
</template>
