<script setup lang="ts">
import type { IGroupMemberInput } from '@shared/interfaces';
import type { ActionReport } from '@renderer/components/ActionController/ActionReport';

import { computed, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';
import useReviewerGroupsStore from '@renderer/stores/storeReviewerGroups';

import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import { createReviewerGroup } from '@renderer/services/organization';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  isLoggedInOrganization,
  matchLabelPrefix,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager';

import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
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
useSetDynamicLayout(LOGGED_IN_LAYOUT);

/* Stores */
const user = useUserStore();
const contacts = useContactsStore();
const reviewerGroups = useReviewerGroupsStore();

/* Injected */
const toastManager = ToastManager.inject();

/* State */
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
const canSubmit = computed(() => name.value.trim().length > 0 && members.value.length > 0);

const hasUnsavedChanges = computed(
  () => name.value.trim().length > 0 || description.value.trim().length > 0 || members.value.length > 0,
);

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

const handleCreate = async (personalPassword: string | null): Promise<ActionReport | null> => {
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

  const snapshotPayload = {
    name: name.value.trim(),
    description: description.value.trim() || null,
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

  await createReviewerGroup(user.selectedOrganization.serverUrl, {
    name: snapshotPayload.name,
    description: snapshotPayload.description ?? undefined,
    threshold: effectiveThreshold,
    members: members.value,
    userKeyId,
    userSignature,
  });

  toastManager.success('Reviewer group created successfully');
  await reviewerGroups.fetch();
  leaveConfirmed.value = true;
  router.back();

  return null;
};

/* Watch */
watch(
  () => user.selectedOrganization,
  () => {
    if (!isLoggedInOrganization(user.selectedOrganization)) {
      router.push({ name: 'transactions' });
    }
  },
);

/* Guards */
onBeforeRouteLeave(to => {
  if (leaveConfirmed.value || !hasUnsavedChanges.value) return true;

  pendingLeavePath.value = to.fullPath;
  confirmLeaveModalShown.value = true;
  return false;
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

      <h2 class="text-title text-bold">New Reviewer Group</h2>
    </div>

    <form
      class="mt-5 col-12 col-md-8 col-lg-6 col-xxl-4 flex-column-100"
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
          Create
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
      :action-callback="handleCreate"
      :personal-password-required="true"
      progress-title="Create Reviewer Group"
      :progress-text="`Creating group '${name}'`"
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
