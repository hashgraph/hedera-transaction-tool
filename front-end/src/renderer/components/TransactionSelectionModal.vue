<script setup lang="ts">
import { computed, ref } from 'vue';

import { transactionTypeKeys } from '@renderer/components/Transaction/Create/txTypeComponentMapping';

import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
defineProps<{
  group?: boolean;
}>();

/* Models */
const show = defineModel<boolean>('show', { required: true });

/* State */
const activeGroupIndex = ref(0);

/* Computed */
const transactionGroups = computed(() => {
  const groups = [
    {
      groupTitle: 'Account',
      items: [
        { label: 'Create Account', name: transactionTypeKeys.createAccount },
        { label: 'Update Account', name: transactionTypeKeys.updateAccount },
        { label: 'Delete Account', name: transactionTypeKeys.deleteAccount },
        { label: 'Transfer Tokens', name: transactionTypeKeys.transfer },
        { label: 'Approve Allowance', name: transactionTypeKeys.approveAllowance },
      ],
    },
    {
      groupTitle: 'File',
      items: [
        { label: 'Create File', name: transactionTypeKeys.createFile },
        { label: 'Update File', name: transactionTypeKeys.updateFile },
        { label: 'Read File', name: transactionTypeKeys.readFile },
        { label: 'Append to File', name: transactionTypeKeys.appendToFile },
        // { label: 'Delete File', name: transactionTypeKeys.deleteFile },
      ],
    },
    // { groupTitle: 'Token Service', items: [] },
    // { groupTitle: 'Smart Contract Service', items: [] },
    {
      groupTitle: 'Node',
      items: [
        { label: 'Freeze', name: transactionTypeKeys.freeze },
        { label: 'Node Create', name: transactionTypeKeys.nodeCreate },
        { label: 'Node Delete', name: transactionTypeKeys.nodeDelete },
        { label: 'Node Update', name: transactionTypeKeys.nodeUpdate },
      ],
    },
    {
      groupTitle: 'System',
      items: [
        { label: 'System Delete', name: transactionTypeKeys.systemDelete },
        { label: 'System Undelete', name: transactionTypeKeys.systemUndelete },
      ],
    },
    // { groupTitle: 'Token Service', items: [] },
    // { groupTitle: 'Schedule Service', items: [] },
    // { groupTitle: 'Freeze Service', items: [] },
  ];

  return groups;
});
</script>
<template>
  <AppModal v-model:show="show" class="large-modal">
    <div class="p-5" style="height: 330px">
      <div class="d-flex align-items-center">
        <i
          class="bi bi-x-lg cursor-pointer me-5"
          style="line-height: 16px"
          @click="show = false"
        ></i>
        <h3 class="text-subheader fw-medium flex-1">Select type of Transaction</h3>
      </div>
      <div class="row mt-5">
        <div class="col-5">
          <template v-for="(group, i) in transactionGroups" :key="group.groupTitle">
            <a
              :data-testid="`menu-link-${group.groupTitle.toLowerCase()}`"
              class="link-menu cursor-pointer fw-bold mt-2"
              :class="{ active: activeGroupIndex === i }"
              @click="activeGroupIndex = i"
            >
              {{ group.groupTitle }}
            </a>
          </template>
        </div>
        <div class="col-7">
          <div class="border-start ps-2">
            <template v-for="item in transactionGroups[activeGroupIndex].items" :key="item.name">
              <a
                :data-testid="`menu-sub-link-${item.name.toLowerCase()}`"
                class="link-menu cursor-pointer"
                @click="
                  $router.push({
                    name: 'createTransaction',
                    params: { type: item.name },
                    query: { group: `${group}` },
                  })
                "
              >
                {{ item.label }}
              </a>
            </template>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>
