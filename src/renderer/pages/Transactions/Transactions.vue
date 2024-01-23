<script setup lang="ts">
import { computed, ref } from 'vue';

import History from './components/History.vue';
import AppTabs, { TabItem } from '../../components/ui/AppTabs.vue';
import AppButton from '../../components/ui/AppButton.vue';
import AppModal from '../../components/ui/AppModal.vue';

/* State */
const tabItems = ref<TabItem[]>([
  { title: 'Ready for Review' },
  { title: 'Ready to Sign' },
  { title: 'In Progress' },
  { title: 'Ready for Submission' },
  { title: 'History' },
  { title: 'Drafts' },
]);
const activeTabIndex = ref(4);

const isTransactionTypeModalShown = ref(false);

/* Computed */
const activeTabTitle = computed(() => tabItems.value[activeTabIndex.value].title);

/* Misc */
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
  <div class="p-5">
    <h1 class="text-title text-bold">Transactions</h1>
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
      <AppTabs :items="tabItems" v-model:active-index="activeTabIndex"></AppTabs>
      <template v-if="activeTabTitle === 'Ready for Review'"></template>
      <template v-if="activeTabTitle === 'Ready to Sign'"> </template>
      <template v-if="activeTabTitle === 'In Progress'"></template>
      <template v-if="activeTabTitle === 'Ready for Submission'"></template>
      <template v-if="activeTabTitle === 'History'"><History /></template>
      <template v-if="activeTabTitle === 'Drafts'"></template>
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
        <div class="mt-5 row flex-wrap">
          <template v-for="(group, _groupIndex) in transactionGroups" :key="_groupIndex">
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
