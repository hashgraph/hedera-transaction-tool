<script setup lang="ts">
import type { ActionReport } from '@renderer/components/ActionController/ActionReport';

import { ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { deleteReviewerRule } from '@renderer/services/organization';

import { assertIsLoggedInOrganization, assertUserLoggedIn } from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import { resolveReviewerSigningKey, signReviewerPayload } from './signReviewerPayload';

/* Props */
const props = defineProps<{ ruleId: number; ruleLabel: string }>();

/* Model */
const show = defineModel<boolean>('show', { required: true });

/* Emits */
const emit = defineEmits<{ (event: 'deleted'): void }>();

/* Stores */
const user = useUserStore();

/* Injected */
const toastManager = ToastManager.inject();

/* State */
const activate = ref(false);

/* Handlers */
const handleConfirmClick = () => {
  activate.value = true;
};

const handleDelete = async (personalPassword: string | null): Promise<ActionReport | null> => {
  assertUserLoggedIn(user.personal);
  assertIsLoggedInOrganization(user.selectedOrganization);

  const signingKey = resolveReviewerSigningKey(user.keyPairs, user.selectedOrganization.userKeys);
  if ('title' in signingKey) return signingKey;

  const { userKeyId, userSignature } = await signReviewerPayload(
    user.personal.id,
    personalPassword,
    signingKey.orgKeyId,
    signingKey.orgKeyPublicKey,
    { action: 'delete', ruleId: props.ruleId },
  );

  await deleteReviewerRule(user.selectedOrganization.serverUrl, props.ruleId, {
    userKeyId,
    userSignature,
  });

  toastManager.success('Rule deletion requested — pending member attestation');
  emit('deleted');
  show.value = false;

  return null;
};
</script>
<template>
  <AppModal v-model:show="show" :close-on-click-outside="false" class="common-modal">
    <div class="p-4">
      <div class="text-center">
        <AppCustomIcon :name="'bin'" style="height: 160px" />
      </div>
      <h3 class="text-center text-title text-bold mt-3">Delete Rule</h3>
      <p class="text-center text-small text-secondary mt-4">
        Are you sure you want to delete the rule for "{{ ruleLabel }}"? The deletion won't take
        effect until it's attested to by the group's members.
      </p>
      <hr class="separator my-5" />
      <div class="row mt-4">
        <div class="col-6">
          <AppButton color="borderless" type="button" class="w-100" @click="show = false"
            >Cancel</AppButton
          >
        </div>
        <div class="col-6 d-grid">
          <AppButton
            color="danger"
            type="button"
            data-testid="button-confirm-delete-reviewer-rule"
            @click="handleConfirmClick"
            >Remove</AppButton
          >
        </div>
      </div>
    </div>

    <ActionController
      v-model:activate="activate"
      :action-callback="handleDelete"
      :personal-password-required="true"
      progress-title="Delete Reviewer Rule"
      :progress-text="`Requesting deletion of '${ruleLabel}'`"
      data-testid="action-controller-delete-reviewer-rule"
    />
  </AppModal>
</template>
