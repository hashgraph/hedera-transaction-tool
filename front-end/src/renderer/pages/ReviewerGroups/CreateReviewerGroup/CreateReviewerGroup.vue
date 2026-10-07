<script setup lang="ts">
import type { IGroupMemberInput } from '@shared/interfaces';
import type { ActionReport } from '@renderer/components/ActionController/ActionReport';

import { computed, onBeforeMount, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';
import useReviewerGroupsStore from '@renderer/stores/storeReviewerGroups';

import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import { createReviewerGroup, getReviewerGroup, updateReviewerGroup } from '@renderer/services/organization';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  getErrorMessage,
  matchLabelPrefix,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager';

import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppTextArea from '@renderer/components/ui/AppTextArea.vue';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import SelectGroupMembersModal from '@renderer/components/ReviewerGroups/SelectGroupMembersModal.vue';
import {
  resolveReviewerSigningKey,
  signReviewerPayload,
} from '@renderer/components/ReviewerGroups/signReviewerPayload';

type Selection = { userId: number; userKeyId: number };

/* Composables */
const router = useRouter();
const route = useRoute();
useSetDynamicLayout(LOGGED_IN_LAYOUT);

/* Stores */
const user = useUserStore();
const contacts = useContactsStore();
const reviewerGroups = useReviewerGroupsStore();

/* Injected */
const toastManager = ToastManager.inject();

/* State */
const groupId = computed(() => {
  const raw = route.params.groupId;
  const id = Number(raw);
  return typeof raw === 'string' && raw.length > 0 && Number.isFinite(id) ? id : null;
});
const isEditMode = computed(() => groupId.value !== null);
const isLoadingGroup = ref(false);
const originalSnapshot = ref<{
  name: string;
  description: string;
  threshold: number;
  members: string[];
} | null>(null);
const name = ref('');
const description = ref('');
const members = ref<IGroupMemberInput[]>([]);
// 0 is a sentinel meaning "not manually picked"; the template falls back to
// members.length until the user explicitly chooses a value.
const threshold = ref(0);
const activate = ref(false);
const isPickerModalShown = ref(false);
const confirmLeaveModalShown = ref(false);
const leaveConfirmed = ref(false);
const pendingLeavePath = ref('');

/* Computed */
const canSubmit = computed(
  () =>
    name.value.trim().length > 0 &&
    members.value.length > 0 &&
    (!isEditMode.value || hasUnsavedChanges.value),
);

const hasUnsavedChanges = computed(() => {
  if (!originalSnapshot.value) {
    return (
      name.value.trim().length > 0 || description.value.trim().length > 0 || members.value.length > 0
    );
  }

  const currentMemberKeys = sortedMemberKeys(members.value);
  return (
    name.value.trim() !== originalSnapshot.value.name ||
    description.value.trim() !== originalSnapshot.value.description ||
    (threshold.value || members.value.length) !== originalSnapshot.value.threshold ||
    JSON.stringify(currentMemberKeys) !== JSON.stringify(originalSnapshot.value.members)
  );
});

const alreadyAddedUserIds = computed(() => members.value.map(m => m.userId));

const thresholdItems = computed(() =>
  members.value.length === 0
    ? ['0']
    : Array.from({ length: members.value.length }, (_, i) => String(i + 1)),
);

// Mirrors the `threshold || members.length` display fallback used when reading the
// sentinel elsewhere (handleCreate, etc.), but as a two-way binding for the field, which
// works in strings.
const thresholdModel = computed({
  get: () => String(threshold.value || members.value.length),
  set: (value: string) => {
    threshold.value = Number(value);
  },
});

/* Functions */
const memberDisplayName = (userId: number) =>
  contacts.getContact(userId)?.user.email ?? `User: ${userId}`;

// Identifies a member by both which user and which of their keys was designated — changing
// just the key for an otherwise-unchanged member set must still count as a change.
const memberKey = (m: { userId: number; userKeyId: number }) => `${m.userId}:${m.userKeyId}`;
const sortedMemberKeys = (list: { userId: number; userKeyId: number }[]) =>
  list.map(memberKey).sort();

const sanitizeThreshold = (value: string) => value.replace(/\D/g, '');

// Prefix match against an ascending list of plain integers ("1", "2", ..., "10", "11") —
// the exact item for a given prefix always sorts before any longer item sharing that
// prefix (e.g. "1" before "10"), so the first match found is always the right one.
// caseSensitive since these are plain digits, with no casing to normalize.
const findThresholdMatch = (items: string[], input: string) =>
  matchLabelPrefix(items, input, { caseSensitive: true });

/* Handlers */
const handleSubmitClick = () => {
  if (!canSubmit.value) return;
  activate.value = true;
};

const handlePickerConfirm = (newMembers: Selection[]) => {
  // Keep the member list alphabetical (by username) rather than selection order, so
  // the group's reviewer list reads the same way every time it's viewed.
  const merged = [...members.value, ...newMembers];
  merged.sort((a, b) => memberDisplayName(a.userId).localeCompare(memberDisplayName(b.userId)));
  members.value = merged;
};

const handleRemoveMember = (userId: number) => {
  members.value = members.value.filter(m => m.userId !== userId);
  if (threshold.value > members.value.length) {
    threshold.value = members.value.length;
  }
};

const handleConfirmLeave = () => {
  leaveConfirmed.value = true;
  confirmLeaveModalShown.value = false;
  router.push(pendingLeavePath.value);
};

const loadGroupForEdit = async (id: number) => {
  assertIsLoggedInOrganization(user.selectedOrganization);
  isLoadingGroup.value = true;
  try {
    const detail = await getReviewerGroup(user.selectedOrganization.serverUrl, id);
    name.value = detail.name;
    description.value = detail.description ?? '';
    members.value = detail.members.map(m => ({ userId: m.userId, userKeyId: m.userKeyId }));
    threshold.value = detail.threshold;
    originalSnapshot.value = {
      name: detail.name,
      description: detail.description ?? '',
      threshold: detail.threshold,
      members: sortedMemberKeys(members.value),
    };
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to load reviewer group'));
    router.back();
  } finally {
    isLoadingGroup.value = false;
  }
};

const handleSubmit = async (personalPassword: string | null): Promise<ActionReport | null> => {
  assertUserLoggedIn(user.personal);
  assertIsLoggedInOrganization(user.selectedOrganization);

  const signingKey = resolveReviewerSigningKey(user.keyPairs, user.selectedOrganization.userKeys);
  if ('title' in signingKey) return signingKey;

  const effectiveThreshold = threshold.value || members.value.length;

  const membersWithKeys = members.value.map(m => ({
    userId: m.userId,
    userKeyId: m.userKeyId,
    publicKey: contacts.getContact(m.userId)?.userKeys.find(k => k.id === m.userKeyId)?.publicKey ?? '',
  }));

  // Edit mode's DTO is a partial update — an omitted/undefined description means "leave it
  // unchanged", so clearing the field must send '' explicitly, and the signed snapshot must
  // sign that same string rather than collapsing it to null (which only create mode uses to
  // mean "none", and which the update DTO's string-typed field can't even carry).
  const trimmedDescription = description.value.trim();
  const descriptionForSigning = isEditMode.value ? trimmedDescription : trimmedDescription || null;

  const snapshotPayload = {
    ...(isEditMode.value ? { action: 'update' as const, groupId: groupId.value } : {}),
    name: name.value.trim(),
    description: descriptionForSigning,
    threshold: effectiveThreshold,
    members: membersWithKeys,
  };

  const { userKeyId, userSignature } = await signReviewerPayload(
    user.personal.id,
    personalPassword,
    signingKey.orgKeyId,
    signingKey.orgKeyPublicKey,
    snapshotPayload,
  );

  const dto = {
    name: snapshotPayload.name,
    description: isEditMode.value ? trimmedDescription : trimmedDescription || undefined,
    threshold: effectiveThreshold,
    members: members.value,
    userKeyId,
    userSignature,
  };

  if (isEditMode.value && groupId.value !== null) {
    await updateReviewerGroup(user.selectedOrganization.serverUrl, groupId.value, dto);
    toastManager.success('Group update requested — pending member attestation');
  } else {
    const created = await createReviewerGroup(user.selectedOrganization.serverUrl, dto);
    toastManager.success('Reviewer group created successfully');
    // Edit mode leaves the pre-existing selection alone (the store keeps it automatically
    // as long as the edited group is still in the refetched list); a brand new group isn't
    // selected yet, so switch to it explicitly rather than staying on whatever was selected
    // before navigating here.
    reviewerGroups.selectGroup(created.id);
  }

  await reviewerGroups.fetch();
  leaveConfirmed.value = true;
  router.back();

  return null;
};

/* Watch */
// Switching organizations (including to a different, still-valid one) invalidates this
// form entirely — it was populated against the previous organization's groups/members, and
// submitting would otherwise silently create/update a group under the new one. Leave
// immediately rather than letting onBeforeRouteLeave offer to "Continue Editing" against a
// form that's no longer bound to the organization the user can see.
watch(
  () => user.selectedOrganization,
  () => {
    leaveConfirmed.value = true;
    router.push({ name: 'transactions' });
  },
);

/* Guards */
onBeforeRouteLeave(to => {
  if (leaveConfirmed.value || !hasUnsavedChanges.value) return true;

  pendingLeavePath.value = to.fullPath;
  confirmLeaveModalShown.value = true;
  return false;
});

/* Hooks */
onBeforeMount(() => {
  if (groupId.value !== null) {
    loadGroupForEdit(groupId.value);
  }
});
</script>
<template>
  <div class="p-5 flex-column-100">
    <div class="d-flex align-items-center flex-shrink-0">
      <AppButton
        type="button"
        color="secondary"
        class="btn-icon-only me-4"
        @click="router.back()"
        log-label="back-to-reviewer-groups"
      >
        <i class="bi bi-arrow-left"></i>
      </AppButton>

      <h2 class="text-title text-bold">{{ isEditMode ? 'Edit Reviewer Group' : 'New Reviewer Group' }}</h2>
    </div>

    <div v-if="isLoadingGroup" class="mt-5">
      <AppLoader />
    </div>
    <form
      v-else
      class="mt-5 col-12 col-md-8 col-lg-6 col-xxl-4 d-flex flex-column fill-remaining"
      @submit.prevent="handleSubmitClick"
    >
      <div class="form-group">
        <label class="form-label">Name</label>
        <AppInput v-model="name" filled :limit="75" data-testid="input-reviewer-group-name" />
      </div>

      <div class="form-group mt-4">
        <label class="form-label">Description</label>
        <AppTextArea
          v-model="description"
          filled
          auto-expand
          :rows="1"
          :limit="150"
          data-testid="input-reviewer-group-description"
        />
      </div>

      <div class="form-group mt-4 fill-remaining d-flex flex-column">
        <label class="form-label flex-shrink-0">Reviewers</label>
        <div class="reviewer-list-box mt-2">
          <div class="d-flex align-items-center gap-3 key-threshhold-bg reviewer-list-header px-3 py-2">
            <span class="text-small text-semi-bold">Threshold</span>
            <AppAutoComplete
              v-model="thresholdModel"
              :items="thresholdItems"
              :sanitize="sanitizeThreshold"
              :find-match="findThresholdMatch"
              strict-items
              filled
              class="narrow"
              :class="{ 'pe-none': members.length === 0 }"
              :tabindex="members.length === 0 ? -1 : undefined"
              data-testid="input-reviewer-group-threshold"
            />
            <span class="text-small text-nowrap text-secondary">of {{ members.length }}</span>
            <AppButton
              color="primary"
              size="small"
              type="button"
              class="min-w-unset flex-shrink-0 ms-auto"
              data-testid="button-add-group-member"
              @click="isPickerModalShown = true"
            >
              Add Members
            </AppButton>
          </div>
          <ul class="list-group list-group-flush reviewer-list-body">
            <li v-if="members.length === 0" class="list-group-item text-muted text-small">
              No reviewers added yet
            </li>
            <template v-else v-for="member in members" :key="member.userId">
              <li
                class="list-group-item d-flex align-items-center justify-content-between"
                :data-testid="`li-group-member-${member.userId}`"
              >
                <span class="text-small text-truncate">{{ memberDisplayName(member.userId) }}</span>
                <button
                  type="button"
                  class="chip-remove ms-2 lh-1 flex-shrink-0"
                  :aria-label="`Remove ${memberDisplayName(member.userId)}`"
                  :data-testid="`button-remove-group-member-${member.userId}`"
                  @click="handleRemoveMember(member.userId)"
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </li>
            </template>
          </ul>
        </div>
      </div>

      <div class="d-flex justify-content-end gap-4 mt-5 flex-shrink-0">
        <AppButton color="borderless" type="button" @click="router.back()">Cancel</AppButton>
        <AppButton
          color="primary"
          type="submit"
          data-testid="button-submit-create-reviewer-group"
          :disabled="!canSubmit"
        >
          {{ isEditMode ? 'Save Changes' : 'Create' }}
        </AppButton>
      </div>
    </form>

    <SelectGroupMembersModal
      v-model:show="isPickerModalShown"
      :already-added="alreadyAddedUserIds"
      @confirm="handlePickerConfirm"
    />

    <ActionController
      v-model:activate="activate"
      :action-callback="handleSubmit"
      :personal-password-required="true"
      :progress-title="isEditMode ? 'Update Reviewer Group' : 'Create Reviewer Group'"
      :progress-text="isEditMode ? `Requesting update to '${name}'` : `Creating group '${name}'`"
      data-testid="action-controller-create-reviewer-group"
    />

    <AppModal
      :show="confirmLeaveModalShown"
      :close-on-click-outside="false"
      :close-on-escape="false"
      class="small-modal"
    >
      <form class="text-center p-4" @submit.prevent="confirmLeaveModalShown = false">
        <div class="text-start">
          <i class="bi bi-x-lg cursor-pointer" @click="confirmLeaveModalShown = false"></i>
        </div>
        <h2 class="text-title text-semi-bold mt-3">Are you sure you want to leave?</h2>
        <p class="text-small text-secondary mt-3">
          Any unsaved changes to this reviewer group will be lost.
        </p>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton
            color="borderless"
            type="button"
            data-testid="button-confirm-leave-create-reviewer-group"
            @click="handleConfirmLeave"
          >
            Discard Changes
          </AppButton>
          <AppButton color="primary" type="submit" data-testid="button-continue-editing-reviewer-group">
            Continue Editing
          </AppButton>
        </div>
      </form>
    </AppModal>
  </div>
</template>
