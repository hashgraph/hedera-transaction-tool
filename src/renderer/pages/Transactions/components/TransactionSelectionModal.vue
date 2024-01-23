<script setup lang="ts">
import { ref, watch } from 'vue';

import AppModal from '../../../components/ui/AppModal.vue';

/* Props */
const props = defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* State */
const show = ref(props.show);
const activeGroupIndex = ref(0);

/* Misc */
const transactionGroups = [
  {
    groupTitle: 'Crypto Service',
    items: [
      { label: 'Crypto Transfer', name: 'transferHbar' },
      { label: 'Create Account', name: 'createAccount' },
      { label: 'Update Account', name: 'updateAccount' },
      { label: 'Delete Account', name: 'deleteAccount' },
      { label: 'Approve Allowance', name: 'approveHbarAllowance' },
      { label: 'Account Info', name: 'accountInfo' },
    ],
  },
  {
    groupTitle: 'File Service',
    items: [
      { label: 'Create File', name: 'createFile' },
      { label: 'Update File', name: 'updateFile' },
      { label: 'Read File', name: 'readFile' },
      { label: 'Append to File', name: 'appendToFile' },
      // { label: 'Delete File', name: 'deleteFile' },
    ],
  },
  // { groupTitle: 'Token Service', items: [] },
  // { groupTitle: 'Smart Contract Service', items: [] },
  // { groupTitle: 'Consensus Service', items: [] },
  // { groupTitle: 'Token Service', items: [] },
  // { groupTitle: 'Schedule Service', items: [] },
  // { groupTitle: 'Freeze Service', items: [] },
];

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
  <AppModal v-model:show="show" class="transaction-type-selection-modal">
    <div class="p-5">
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
                class="link-menu cursor-pointer"
                @click="$router.push({ name: 'createTransaction', params: { type: item.name } })"
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
