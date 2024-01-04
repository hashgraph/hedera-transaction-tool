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

const transactionGroups = [
  {
    groupTitle: 'Account',
    items: [
      { label: 'Create Account', name: 'createAccount' },
      { label: 'Update Account', name: 'updateAccount' },
      { label: 'Delete Account', name: 'deleteAccount' },
      { label: 'Account Info', name: 'accountInfo' },
    ],
  },
  {
    groupTitle: 'Hbar',
    items: [
      { label: 'Approve Allowance', name: 'approveHbarAllowance' },
      { label: 'Transfer', name: 'transferHbar' },
    ],
  },
  {
    groupTitle: 'File management',
    items: [
      { label: 'Create File', name: 'createFile' },
      { label: 'Update File', name: 'updateFile' },
      { label: 'Read File', name: 'readFile' },
      { label: 'Append to File', name: 'appendToFile' },
      // { label: 'Delete File', name: 'deleteFile' },
    ],
  },
];
</script>

<template>
  <div class="p-10">
    <h1 class="text-huge text-bold">Transactions</h1>
    <div class="mt-7 d-flex">
      <AppButton
        color="primary"
        class="d-flex align-items-center"
        @click="isTransactionTypeModalShown = true"
      >
        <span>Create</span> <i class="bi bi-plus text-subheader ms-2"></i
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
                  class="badge bg-dark-blue-700 text-body d-inline-flex align-items-center fw-normal"
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
    <AppModal v-model:show="isTransactionTypeModalShown" class="transaction-type-selection-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isTransactionTypeModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <h3 class="mt-5 text-display text-center text-bold mb-3">Select type of Transaction</h3>
          <i
            class="bi bi-arrow-left-right large-icon text-light-emphasis"
            style="line-height: 16px"
          ></i>
        </div>
        <!-- <p class="text-center text-light-emphasis text-small">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p> -->
        <div class="mt-5 row flex-wrap">
          <template v-for="(group, groupIndex) in transactionGroups" :key="groupIndex">
            <div class="mt-5 col-4">
              <h3 class="text-title text-bold">{{ group.groupTitle }}</h3>
              <RouterLink
                :to="{ name: 'createTransaction', params: { type: item.name } }"
                v-for="(item, index) in group.items"
                :key="index"
                class="link-primary text-main d-block mt-3"
              >
                {{ item.label }}
              </RouterLink>
            </div>
          </template>
        </div>
      </div>
    </AppModal>
  </div>
</template>
