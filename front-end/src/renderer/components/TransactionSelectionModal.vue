<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { transactionTypeKeys } from '@renderer/pages/CreateTransaction/txTypeComponentMapping';

import useUserStore from '@renderer/stores/storeUser';

import AppModal from '@renderer/components/ui/AppModal.vue';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

/* Props */
const props = defineProps<{
  show: boolean;
  group?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Stores */
const user = useUserStore();

/* State */
const show = ref(props.show);
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
        // { label: 'Account Info', name: transactionTypeKeys.accountInfo },
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
    { groupTitle: 'Node', items: [{ label: 'Freeze', name: transactionTypeKeys.freeze }] },
    // { groupTitle: 'Token Service', items: [] },
    // { groupTitle: 'Schedule Service', items: [] },
    // { groupTitle: 'Freeze Service', items: [] },
  ];

  if (isLoggedInOrganization(user.selectedOrganization)) {
    const fileGroup = groups.find(group => group.groupTitle === 'File');
    if (fileGroup) {
      const toRemove = [transactionTypeKeys.appendToFile, transactionTypeKeys.updateFile];
      fileGroup.items = fileGroup.items.filter(item => !toRemove.includes(item.name));
    }
  }
  return groups;
});

/* Watchers */
watch(show, value => {
  emit('update:show', value);
});
watch(
  () => props.show,
  value => {
    show.value = value;
  },
);
// <RouterLink
//               :to="{ name: 'createTransaction', params: { type: item.name } }"
//               v-for="(item, index) in group.items"
//               :key="index"
//               class="link-primary text-main d-block mt-3"
//             >
//               {{ item.label }}
//             </RouterLink>
</script>
<template>
  <AppModal v-model:show="show" class="large-modal">
    <div class="p-5" style="height: 330px">
      <div class="d-flex align-items-center">
        <i
          class="bi bi-x-lg cursor-pointer me-5"
          style="line-height: 16px"
          @click="$emit('update:show', false)"
        ></i>
        <h3 class="text-subheader fw-medium flex-1">Select type of Transaction</h3>
      </div>
      <div class="row mt-5">
        <div class="col-5">
          <template v-for="(group, i) in transactionGroups" :key="group.groupTitle">
            <a
              :data-testid="`menu-link-${i}`"
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
            <template
              v-for="(item, i) in transactionGroups[activeGroupIndex].items"
              :key="item.name"
            >
              <a
                :data-testid="`menu-sublink-${i}`"
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
