<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  transactionTypeKeys,
  txTypeLabelMapping,
} from '@renderer/components/Transaction/Create/txTypeComponentMapping';

import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  group?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* State */
const show = ref(props.show);
const activeGroupIndex = ref(0);

/* Computed */
const transactionGroups = computed(() => {
  const groups = [
    {
      groupTitle: 'Account',
      transactionTypes: [
        transactionTypeKeys.createAccount,
        transactionTypeKeys.updateAccount,
        transactionTypeKeys.deleteAccount,
        transactionTypeKeys.transfer,
        transactionTypeKeys.approveAllowance,
      ],
    },
    {
      groupTitle: 'File',
      transactionTypes: [
        transactionTypeKeys.createFile,
        transactionTypeKeys.updateFile,
        transactionTypeKeys.readFile,
        transactionTypeKeys.appendToFile,
        // transactionTypeKeys.deleteFile,
      ],
    },
    // { groupTitle: 'Token Service', transactionTypes: [] },
    // { groupTitle: 'Smart Contract Service', transactionTypes: [] },
    {
      groupTitle: 'Node',
      transactionTypes: [
        transactionTypeKeys.freeze,
        transactionTypeKeys.nodeCreate,
        transactionTypeKeys.nodeDelete,
        transactionTypeKeys.nodeUpdate,
      ],
    },
    {
      groupTitle: 'System',
      transactionTypes: [
        transactionTypeKeys.systemDelete,
        transactionTypeKeys.systemUndelete,
      ],
    },
    // { groupTitle: 'Token Service', transactionTypes: [] },
    // { groupTitle: 'Schedule Service', transactionTypes: [] },
    // { groupTitle: 'Freeze Service', transactionTypes: [] },
  ];

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
            <template v-for="t in transactionGroups[activeGroupIndex].transactionTypes" :key="t">
              <a
                :data-testid="`menu-sub-link-${t.toLowerCase()}`"
                class="link-menu cursor-pointer"
                @click="
                  $router.push({
                    name: 'createTransaction',
                    params: { type: t },
                    query: { group: `${group}` },
                  })
                "
              >
                {{ txTypeLabelMapping[t] }}
              </a>
            </template>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>
