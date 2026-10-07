<script setup lang="ts">
import type { IReviewerGroupDetail, IReviewerGroupMember, IReviewerRule } from '@shared/interfaces';

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';

import {
  getReviewerGroup,
  getReviewerGroupChanges,
  getReviewerRuleChanges,
} from '@renderer/services/organization';

import { FEATURE_REVIEWER_ENABLED } from '@shared/constants';

import { assertIsLoggedInOrganization, getErrorMessage, isLoggedInOrganization } from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPublicKeyNickname from '@renderer/components/ui/AppPublicKeyNickname.vue';
import CreateRuleModal from '@renderer/components/ReviewerGroups/CreateRuleModal.vue';
import DeleteGroupModal from '@renderer/components/ReviewerGroups/DeleteGroupModal.vue';
import DeleteRuleModal from '@renderer/components/ReviewerGroups/DeleteRuleModal.vue';
import PendingRuleDeleteButton from '@renderer/components/ReviewerGroups/PendingRuleDeleteButton.vue';
import { formatNetwork, formatRole, formatTransactionType } from './ruleFormatting';

type RuleSortField = 'hederaId' | 'entityRole' | 'transactionType' | 'network';

/* Props */
const props = defineProps<{ groupId: number }>();

/* Composables */
const router = useRouter();

/* Stores */
const user = useUserStore();
const contacts = useContactsStore();

/* Injected */
const toastManager = ToastManager.inject();

/* State */
const group = ref<IReviewerGroupDetail | null>(null);
const fetching = ref(false);
const isCreateRuleModalShown = ref(false);
const isDeleteGroupModalShown = ref(false);
const ruleToDelete = ref<IReviewerRule | null>(null);
// The back-end allows only one PENDING change record per group at a time, so Edit/Remove
// must both stay blocked until it resolves, regardless of which type is pending.
const pendingChangeType = ref<'UPDATE' | 'DELETE' | null>(null);
// Rule creation applies immediately, but rule deletion is a pending change requiring
// member attestation (same as group update/delete) — tracked per rule since, unlike
// group changes, each rule has its own independent change-record history.
const pendingRuleDeletionIds = ref<Set<number>>(new Set());
const ruleSortField = ref<RuleSortField>('hederaId');
const ruleSortDirection = ref<'asc' | 'desc'>('asc');
// Guards against an older fetchGroup() (for a previously-selected group) resolving after a
// newer one — only the most recently started call is allowed to update state.
let latestRequestId = 0;

/* Computed */
const isAdmin = computed(
  () => isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin,
);

const hasPendingChange = computed(() => pendingChangeType.value !== null);

// Replaces Edit/Remove entirely while a change is pending, rather than leaving them
// visible-but-disabled next to an easy-to-miss badge. Once attestation voting exists,
// this should become clickable and navigate there instead of just being inert.
const pendingButtonText = computed(() => {
  switch (pendingChangeType.value) {
    case 'DELETE':
      return 'Delete Pending';
    case 'UPDATE':
      return 'Update Pending';
    default:
      return '';
  }
});

const isDeleteRuleModalShown = computed({
  get: () => ruleToDelete.value !== null,
  set: (value: boolean) => {
    if (!value) ruleToDelete.value = null;
  },
});

const ruleSortIconClass = computed(() =>
  ruleSortDirection.value === 'desc' ? 'bi-arrow-down-short' : 'bi-arrow-up-short',
);

const sortedRules = computed(() => {
  const direction = ruleSortDirection.value === 'asc' ? 1 : -1;
  return [...(group.value?.rules ?? [])].sort(
    (a, b) =>
      ruleSortValue(a, ruleSortField.value).localeCompare(ruleSortValue(b, ruleSortField.value)) *
      direction,
  );
});

/* Functions */
function memberPublicKey(member: IReviewerGroupMember): string {
  return contacts.getContact(member.userId)?.userKeys.find(k => k.id === member.userKeyId)?.publicKey ?? '';
}

function ruleSortValue(rule: IReviewerRule, field: RuleSortField): string {
  switch (field) {
    case 'hederaId':
      return rule.hederaId;
    case 'entityRole':
      return formatRole(rule.entityRole);
    case 'transactionType':
      return formatTransactionType(rule.transactionType);
    case 'network':
      return formatNetwork(rule.network);
  }
}

function handleRuleSort(field: RuleSortField) {
  if (ruleSortField.value === field) {
    ruleSortDirection.value = ruleSortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    ruleSortField.value = field;
    ruleSortDirection.value = 'asc';
  }
}

async function fetchGroup() {
  assertIsLoggedInOrganization(user.selectedOrganization);
  const serverUrl = user.selectedOrganization.serverUrl;
  const requestId = ++latestRequestId;
  fetching.value = true;
  try {
    const [detail, changes] = await Promise.all([
      getReviewerGroup(serverUrl, props.groupId),
      getReviewerGroupChanges(serverUrl, props.groupId),
    ]);
    if (requestId !== latestRequestId) return;
    group.value = detail;
    pendingChangeType.value = changes.find(c => c.status === 'PENDING')?.type ?? null;
  } catch (error) {
    if (requestId !== latestRequestId) return;
    toastManager.error(getErrorMessage(error, 'Failed to load reviewer group'));
    group.value = null;
    fetching.value = false;
    return;
  }

  // Kept out of the try block above: a transient failure fetching one rule's change
  // history shouldn't discard the group/rules we already successfully loaded.
  try {
    const rules = group.value.rules;
    const ruleChangeLists = await Promise.all(
      rules.map(rule => getReviewerRuleChanges(serverUrl, rule.id)),
    );
    if (requestId !== latestRequestId) return;
    pendingRuleDeletionIds.value = new Set(
      rules
        .filter((_, index) => ruleChangeLists[index].some(change => change.status === 'PENDING'))
        .map(rule => rule.id),
    );
  } catch (error) {
    if (requestId === latestRequestId) {
      toastManager.error(getErrorMessage(error, 'Failed to load rule pending-delete status'));
    }
  } finally {
    if (requestId === latestRequestId) fetching.value = false;
  }
}

async function handleRuleCreated() {
  await fetchGroup();
}

async function handleGroupDeleted() {
  await fetchGroup();
}

async function handleRuleDeleted() {
  ruleToDelete.value = null;
  await fetchGroup();
}

function handleRuleRemoveClick(rule: IReviewerRule) {
  ruleToDelete.value = rule;
}

function handleEditClick() {
  router.push({ name: 'createReviewerGroup', params: { groupId: String(props.groupId) } });
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
          <AppButton
            v-if="hasPendingChange"
            color="secondary"
            type="button"
            class="min-w-unset"
            disabled
            data-testid="button-pending-reviewer-group-change"
            >{{ pendingButtonText }}</AppButton
          >
          <template v-else>
            <AppButton
              color="danger"
              type="button"
              class="min-w-unset"
              data-testid="button-remove-reviewer-group"
              @click="isDeleteGroupModalShown = true"
              ><span class="bi bi-trash"></span> Remove</AppButton
            >
            <div class="border-start ps-3">
              <AppButton
                color="borderless"
                type="button"
                class="min-w-unset"
                data-testid="button-edit-reviewer-group"
                @click="handleEditClick"
                ><span class="bi bi-pencil-square"></span> Edit</AppButton
              >
            </div>
          </template>
        </div>
      </div>
      <p v-if="group.description" class="text-secondary mt-2">{{ group.description }}</p>

      <hr class="separator my-5" />

      <h3 class="text-small text-semi-bold">
        Reviewer Threshold: {{ group.threshold }} of {{ group.members.length }}
      </h3>
      <ul class="mt-3 ps-4">
        <li v-for="member in group.members" :key="member.id" class="mt-2">
          <AppPublicKeyNickname :public-key="memberPublicKey(member)" truncate-key />
        </li>
      </ul>

      <hr class="separator my-5" />

      <div class="d-flex justify-content-between align-items-center">
        <h3 class="text-small text-semi-bold mb-0">Rules</h3>
        <AppButton
          v-if="isAdmin"
          color="primary"
          type="button"
          size="small"
          class="text-small min-w-unset"
          data-testid="button-add-reviewer-rule"
          @click="isCreateRuleModalShown = true"
          >Add Rule</AppButton
        >
      </div>
      <template v-if="sortedRules.length > 0">
        <div class="overflow-x-auto mt-3">
          <table class="table-custom">
            <thead>
              <tr>
                <th>
                  <div class="table-sort-link" @click="handleRuleSort('hederaId')">
                    <span>Entity / Node ID</span>
                    <i
                      v-if="ruleSortField === 'hederaId'"
                      class="bi text-title"
                      :class="[ruleSortIconClass]"
                    ></i>
                  </div>
                </th>
                <th>
                  <div class="table-sort-link" @click="handleRuleSort('entityRole')">
                    <span>Role</span>
                    <i
                      v-if="ruleSortField === 'entityRole'"
                      class="bi text-title"
                      :class="[ruleSortIconClass]"
                    ></i>
                  </div>
                </th>
                <th>
                  <div class="table-sort-link" @click="handleRuleSort('transactionType')">
                    <span>Transaction Type</span>
                    <i
                      v-if="ruleSortField === 'transactionType'"
                      class="bi text-title"
                      :class="[ruleSortIconClass]"
                    ></i>
                  </div>
                </th>
                <th>
                  <div class="table-sort-link" @click="handleRuleSort('network')">
                    <span>Network</span>
                    <i
                      v-if="ruleSortField === 'network'"
                      class="bi text-title"
                      :class="[ruleSortIconClass]"
                    ></i>
                  </div>
                </th>
                <th v-if="isAdmin"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="rule in sortedRules"
                :key="rule.id"
                :data-testid="`row-reviewer-rule-${rule.id}`"
                :class="{ 'reviewer-rule-row-pending-delete': pendingRuleDeletionIds.has(rule.id) }"
              >
                <td>{{ rule.hederaId }}</td>
                <td>{{ formatRole(rule.entityRole) }}</td>
                <td>{{ formatTransactionType(rule.transactionType) }}</td>
                <td>{{ formatNetwork(rule.network) }}</td>
                <td v-if="isAdmin">
                  <PendingRuleDeleteButton
                    v-if="pendingRuleDeletionIds.has(rule.id)"
                    :data-testid="`button-pending-reviewer-rule-${rule.id}`"
                  />
                  <AppButton
                    v-else
                    size="small"
                    color="danger"
                    type="button"
                    class="min-w-unset"
                    :data-testid="`button-remove-reviewer-rule-${rule.id}`"
                    @click="handleRuleRemoveClick(rule)"
                    ><span class="bi bi-trash"></span
                  ></AppButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <p v-else class="text-secondary text-center mt-5">No rules assigned to this group yet.</p>

      <CreateRuleModal
        v-model:show="isCreateRuleModalShown"
        :group-id="group.id"
        @created="handleRuleCreated"
      />
      <DeleteGroupModal
        v-model:show="isDeleteGroupModalShown"
        :group-id="group.id"
        :group-name="group.name"
        @deleted="handleGroupDeleted"
      />
      <DeleteRuleModal
        v-if="ruleToDelete"
        v-model:show="isDeleteRuleModalShown"
        :rule-id="ruleToDelete.id"
        :rule-label="ruleToDelete.hederaId"
        @deleted="handleRuleDeleted"
      />
    </template>
  </div>
</template>
