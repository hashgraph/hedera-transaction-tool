<script setup lang="ts">
import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useReviewerGroupsStore from '@renderer/stores/storeReviewerGroups';

import useRedirectOnOnlyOrganization from '@renderer/composables/useRedirectOnOnlyOrganization';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import { isLoggedInOrganization } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import ReviewerGroupDetails from './components/ReviewerGroupDetails.vue';

/* Stores */
const user = useUserStore();
const reviewerGroups = useReviewerGroupsStore();

/* Composables */
useRedirectOnOnlyOrganization();
useSetDynamicLayout(LOGGED_IN_LAYOUT);

/* State */
const selectedId = ref<number | null>(null);

/* Handlers */
function handleSelectGroup(id: number) {
  selectedId.value = id;
}

/* Watch */
// Fetching is owned entirely by the store's own immediate watch on the selected org (see
// storeReviewerGroups.ts), same as storeContacts/ContactList — not re-triggered on every mount,
// so revisiting this page after the first load shows cached groups instantly instead of
// flashing the loader again. Re-picks the first group whenever the list changes (including
// once the initial fetch resolves) rather than reading it once synchronously on mount, which
// would race the fetch on a cold start.
watch(
  () => reviewerGroups.groups,
  groups => {
    selectedId.value = groups[0]?.id ?? null;
  },
  { immediate: true },
);
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
              disabled
              title="Coming soon"
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
                  :class="{ 'is-selected': group.id === selectedId }"
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
          <ReviewerGroupDetails v-if="selectedId !== null" :group-id="selectedId" />
        </div>
      </div>
    </div>
  </div>
</template>
