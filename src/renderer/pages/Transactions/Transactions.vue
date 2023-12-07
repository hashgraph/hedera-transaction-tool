<script setup lang="ts">
import { reactive, ref } from 'vue';

import AppTabs, { TabItem } from '../../components/ui/AppTabs.vue';
import AppButton from '../../components/ui/AppButton.vue';
import AppModal from '../../components/ui/AppModal.vue';

/* Tabs */
const activeTabIndex = ref(1);

const tabItems: TabItem[] = [
  { title: 'Ready for Review' },
  { title: 'Ready to Sign', notifications: 3 },
  { title: 'In Progress' },
  { title: 'Ready for Submission' },
  { title: 'Completed' },
  { title: 'Drafts' },
];

const [readyToReview, readyToSign, inProgress, readyForSubmission, completed, drafts] =
  tabItems.map(t => t.title);

const transactions = reactive([
  {
    id: 1,
    title: 'Update the keys for account 0.01234 because of new employee',
    account: '0.0.1234(Bobs Account)',
    type: 'send',
    approvers: ['alice@acme.com', 'joe@acme.com'],
  },
  {
    id: 2,
    title: 'Update the keys for account 0.01234 because of new employee',
    account: '0.0.1224(Bobs Account)',
    type: 'receive',
    approvers: ['alice@acme.com'],
  },
  {
    id: 3,
    title: 'Update the keys for account 0.01234 because of new employee',
    account: '0.0.12224(Bobs Account)',
    type: 'send',
    approvers: ['alice@acme.com', 'joe@acme.com'],
  },
]);

/* Create Transaction */
const isTransactionTypeModalShown = ref(false);
</script>

<template>
  <div class="p-10">
    <h1 class="text-huge text-bold">Transactions</h1>
    <div class="mt-7 d-flex justify-content-end">
      <AppButton
        color="secondary"
        class="rounded-4 d-flex align-items-center"
        @click="isTransactionTypeModalShown = true"
      >
        <span>Create</span> <i class="bi bi-plus text-subheader"></i
      ></AppButton>
    </div>
    <div class="mt-4">
      <AppTabs :items="tabItems" v-model:active-index="activeTabIndex">
        <template #[readyToReview]> First Tab </template>
        <template #[readyToSign]>
          <div>
            <div
              v-for="(item, index) in transactions"
              :key="index"
              class="rounded bg-dark-blue-700 p-4 overflow-hidden"
              :class="{ 'mt-4': index !== 0 }"
            >
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <p class="text-main d-flex align-items-center">
                    <i
                      v-if="item.type === 'send'"
                      class="bi bi-arrow-up-right me-3 text-info text-title fw-bolder"
                    ></i>
                    <i
                      v-else-if="item.type === 'receive'"
                      class="bi bi-arrow-down-left me-3 text-success text-title fw-bold"
                    ></i>
                    {{ item.title }}
                  </p>
                  <p class="text-micro mt-3">{{ item.account }}</p>
                </div>
                <div>
                  <div class="d-flex justify-content-end align-items-center">
                    <AppButton color="primary" outline class="me-3">Details</AppButton>
                    <AppButton color="secondary">Sign</AppButton>
                  </div>
                </div>
              </div>

              <div class="mt-4 d-inline-flex align-items-center">
                <span class="text-micro me-4">Approvers</span>
                <span
                  v-for="(approver, index) in item.approvers"
                  :key="index"
                  class="badge bg-dark-blue-700 d-inline-flex align-items-center fw-normal"
                  :class="{ 'me-2': index !== item.approvers.length }"
                  ><i class="bi bi-check-lg text-success text-subheader lh-1 me-1"></i
                  >{{ approver }}</span
                >
              </div>
            </div>
          </div>
        </template>
        <template #[inProgress]> Third Tab </template>

        <template #[readyForSubmission]> Fourth Tab </template>

        <template #[completed]> Fifth Tab </template>

        <template #[drafts]> Sixth Tab </template>
      </AppTabs>
    </div>
    <AppModal v-model:show="isTransactionTypeModalShown">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isTransactionTypeModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i
            class="bi bi-arrow-left-right extra-large-icon cursor-pointer"
            style="line-height: 16px"
            @click="isTransactionTypeModalShown = false"
          ></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold">Select type of Transaction</h3>
        <p class="text-center text-small">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
        <div class="mt-5 row flex-wrap gap-4">
          <div class="col-3">
            <h3 class="text-main text-bold">Group</h3>
            <div class="mt-4">Item</div>
            <div class="mt-4">Item</div>
            <div class="mt-4">Item</div>
          </div>
          <div class="col-3">
            <h3 class="text-main text-bold">Group</h3>
            <div class="mt-4">Item</div>
            <div class="mt-4">Item</div>
            <div class="mt-4">Item</div>
          </div>
          <div class="col-3">
            <h3 class="text-main text-bold">Group</h3>
            <div class="mt-4">Item</div>
            <div class="mt-4">Item</div>
            <div class="mt-4">Item</div>
          </div>
          <div class="col-3">
            <h3 class="text-main text-bold">Group</h3>
            <div class="mt-4">Item</div>
            <div class="mt-4">Item</div>
            <div class="mt-4">Item</div>
          </div>
          <div class="col-3">
            <h3 class="text-main text-bold">Group</h3>
            <div class="mt-4">Item</div>
            <div class="mt-4">Item</div>
            <div class="mt-4">Item</div>
          </div>
        </div>
      </div>
    </AppModal>
  </div>
</template>
