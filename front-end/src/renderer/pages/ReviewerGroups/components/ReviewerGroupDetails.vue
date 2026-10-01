<script setup lang="ts">
import type { IReviewerGroupDetail, IReviewerGroupMember } from '@shared/interfaces';

import { computed, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';

import { getReviewerGroup, getReviewerGroupChanges } from '@renderer/services/organization';

import { FEATURE_REVIEWER_ENABLED } from '@shared/constants';

import { assertIsLoggedInOrganization, getErrorMessage, isLoggedInOrganization } from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPublicKeyNickname from '@renderer/components/ui/AppPublicKeyNickname.vue';
import { formatNetwork, formatRole, formatTransactionType } from '@renderer/components/ReviewerGroups/ruleDescription';

/* Props */
const props = defineProps<{ groupId: number }>();

/* Stores */
const user = useUserStore();
const contacts = useContactsStore();

/* Injected */
const toastManager = ToastManager.inject();

/* State */
const group = ref<IReviewerGroupDetail | null>(null);
const fetching = ref(false);
const pendingDeletion = ref(false);

/* Computed */
const isAdmin = computed(
  () => isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin,
);

/* Functions */
function memberPublicKey(member: IReviewerGroupMember): string {
  return contacts.getContact(member.userId)?.userKeys.find(k => k.id === member.userKeyId)?.publicKey ?? '';
}

async function fetchGroup() {
  assertIsLoggedInOrganization(user.selectedOrganization);
  fetching.value = true;
  try {
    const [detail, changes] = await Promise.all([
      getReviewerGroup(user.selectedOrganization.serverUrl, props.groupId),
      getReviewerGroupChanges(user.selectedOrganization.serverUrl, props.groupId),
    ]);
    group.value = detail;
    pendingDeletion.value = changes.some(c => c.status === 'PENDING' && c.type === 'DELETE');
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to load reviewer group'));
    group.value = null;
  } finally {
    fetching.value = false;
  }
}

/* Watch */
watch(() => props.groupId, fetchGroup, { immediate: true });
</script>
<template>
  <div class="container-fluid flex-column-100 position-relative">
    <template v-if="fetching">
      <div class="mt-5">
        <AppLoader />
      </div>
    </template>
    <template v-else-if="group">
      <div class="d-flex justify-content-between align-items-center">
        <h2 class="text-title text-bold" data-testid="p-reviewer-group-name">{{ group.name }}</h2>
        <div v-if="FEATURE_REVIEWER_ENABLED && isAdmin" class="d-flex align-items-center gap-3">
          <span v-if="pendingDeletion" class="badge bg-warning" data-testid="badge-reviewer-group-pending">
            Pending
          </span>
          <AppButton
            color="danger"
            type="button"
            class="min-w-unset"
            disabled
            title="Coming soon"
            data-testid="button-remove-reviewer-group"
            ><span class="bi bi-trash"></span> Remove</AppButton
          >
        </div>
      </div>
      <p v-if="group.description" class="text-secondary mt-2">{{ group.description }}</p>

      <hr class="separator my-5" />

      <h3 class="text-small text-semi-bold">
        Reviewer Threshold: {{ group.threshold }} of {{ group.members.length }}
      </h3>
      <ul class="mt-3 ps-4">
        <li v-for="member in group.members" :key="member.id" class="mt-2">
          <AppPublicKeyNickname :public-key="memberPublicKey(member)" />
        </li>
      </ul>

      <hr class="separator my-5" />

      <div class="d-flex align-items-center gap-3">
        <h3 class="text-small text-semi-bold mb-0">Rules</h3>
        <AppButton
          v-if="isAdmin"
          color="borderless"
          type="button"
          class="min-w-unset"
          title="Coming soon"
          disabled
          data-testid="button-add-reviewer-rule"
        >
          <span class="bi bi-plus-lg fs-4"></span>
        </AppButton>
      </div>
      <template v-if="group.rules.length > 0">
        <div class="overflow-x-auto mt-3">
          <table class="table-custom">
            <thead>
              <tr>
                <th>Entity / Node ID</th>
                <th>Role</th>
                <th>Transaction Type</th>
                <th>Network</th>
              </tr>
            </thead>
            <tbody class="text-secondary">
              <tr v-for="rule in group.rules" :key="rule.id" :data-testid="`row-reviewer-rule-${rule.id}`">
                <td>{{ rule.hederaEntityId }}</td>
                <td>{{ formatRole(rule.entityRole) }}</td>
                <td>{{ formatTransactionType(rule.transactionType) }}</td>
                <td>{{ formatNetwork(rule.network) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <p v-else class="text-secondary mt-3">No rules assigned to this group yet.</p>
    </template>
  </div>
</template>
