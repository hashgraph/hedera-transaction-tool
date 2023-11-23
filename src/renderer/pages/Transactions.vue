<script setup lang="ts">
import { reactive, ref } from 'vue';

import Tabs, { TabItem } from '../components/ui/Tabs.vue';

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
  },
  {
    id: 2,
    title: 'Update the keys for account 0.01234 because of new employee',
    account: '0.0.1224(Bobs Account)',
  },
  {
    id: 3,
    title: 'Update the keys for account 0.01234 because of new employee',
    account: '0.0.12224(Bobs Account)',
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
              class="rounded bg-dark-blue-800 p-4"
              :class="{ 'mt-4': index !== 0 }"
            >
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <p class="text-main">{{ item.title }}</p>
                  <p class="text-micro mt-3">{{ item.account }}</p>
                </div>
                <div>
                  <div class="d-flex justify-content-end align-items-center">
                    <button class="btn btn-outline-primary me-3">Details</button>
                    <button class="btn btn-primary">Sign</button>
                  </div>
                </div>
              </div>

              <div class="mt-4">
                <span class="text-micro me-4">Approvers</span>
                <span class="badge text-bg-primary me-2">alice@acme.com</span>
                <span class="badge text-bg-primary">joe@acme.com</span>
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
