<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';
import useReviewerGroupsStore from '@renderer/stores/storeReviewerGroups';

import useRedirectOnOnlyOrganization from '@renderer/composables/useRedirectOnOnlyOrganization';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import { assertIsLoggedInOrganization, isLoggedInOrganization } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import NoSigningKeyModal from '@renderer/components/ReviewerGroups/NoSigningKeyModal.vue';
import ReviewerGroupDetails from './components/ReviewerGroupDetails.vue';
import { resolveReviewerSigningKey } from '@renderer/components/ReviewerGroups/signReviewerPayload';

/* Stores */
const user = useUserStore();
const reviewerGroups = useReviewerGroupsStore();

/* Composables */
const router = useRouter();
useRedirectOnOnlyOrganization();
useSetDynamicLayout(LOGGED_IN_LAYOUT);

/* State */
const showNoSigningKeyModal = ref(false);

/* Handlers */
function handleSelectGroup(id: number) {
  reviewerGroups.selectGroup(id);
}

// Checked here, before navigating to the create form, rather than only at submit time —
// otherwise a user without a usable key fills out the whole form before being told to go
// set one up, losing everything they entered.
function handleAddNewClick() {
  assertIsLoggedInOrganization(user.selectedOrganization);
  const signingKey = resolveReviewerSigningKey(user.keyPairs, user.selectedOrganization.userKeys);
  if ('title' in signingKey) {
    showNoSigningKeyModal.value = true;
    return;
  }

  router.push({ name: 'createReviewerGroup' });
}

// Fetching, and which group is selected, are both owned by the store (see
// storeReviewerGroups.ts) rather than local state — this page remounts on every trip to/from
// createReviewerGroup, and a local ref would forget the selection on the way back.
</script>
<template>
  <div class="px-4 px-xxl-6 py-5">
    <div class="container-fluid flex-column-100">
      <div class="d-flex justify-content-between">
        <h1 class="text-title text-bold">Reviewer Groups</h1>
      </div>

      <div class="row g-0 fill-remaining mt-6">
        <div class="col-4 col-xxl-3 flex-column-100 overflow-hidden with-border-end pe-4 ps-0">
          <template
            v-if="isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin"
          >
            <AppButton
              color="primary"
              type="button"
              data-testid="button-add-reviewer-group"
              size="large"
              class="w-100 d-flex align-items-center justify-content-center"
              @click="handleAddNewClick"
            >
              Add New
            </AppButton>

            <hr class="separator my-5" />
          </template>

          <div class="fill-remaining pe-3">
            <template v-if="reviewerGroups.fetching">
              <div class="mt-5">
                <AppLoader />
              </div>
            </template>
            <template v-else-if="reviewerGroups.groups.length > 0">
              <template v-for="group in reviewerGroups.groups" :key="group.id">
                <div
                  class="container-multiple-select overflow-hidden p-4 mt-3"
                  :class="{ 'is-selected': group.id === reviewerGroups.selectedGroupId }"
                  :data-testid="`div-reviewer-group-${group.id}`"
                  @click="handleSelectGroup(group.id)"
                >
                  <p class="text-small text-semi-bold overflow-hidden">{{ group.name }}</p>
                  <p class="text-micro text-secondary text-truncate mt-2">
                    {{ group.description }}
                  </p>
                </div>
              </template>
            </template>
            <template v-else>
              <p class="text-small text-semi-bold text-center mt-5" data-testid="p-no-groups-found">
                No reviewer groups found
              </p>
            </template>
          </div>
        </div>

        <div class="col-8 col-xxl-9 flex-column-100 ps-4">
          <ReviewerGroupDetails
            v-if="reviewerGroups.selectedGroupId !== null"
            :group-id="reviewerGroups.selectedGroupId"
          />
        </div>
      </div>
    </div>

    <NoSigningKeyModal v-model:show="showNoSigningKeyModal" />
  </div>
</template>
