<script setup lang="ts">
import { reactive, ref } from 'vue';

import Tabs from '../../components/ui/Tabs';
import AppButton from '../../components/ui/AppButton.vue';

const activeTabIndex = ref(1);

const tabItems = [
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
</script>

<template>
  <div class="p-10">
    <h1 class="text-huge text-bold">Transactions</h1>
    <div class="mt-7">
      <Tabs :items="tabItems" v-model:active-index="activeTabIndex">
        <template #[readyToReview]> First Tab </template>
        <template #[readyToSign]>
          <div>
            <div
              v-for="(item, index) in transactions"
              :key="index"
              class="rounded bg-dark-blue-800 p-4 overflow-hidden"
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
      </Tabs>
    </div>
  </div>
</template>
