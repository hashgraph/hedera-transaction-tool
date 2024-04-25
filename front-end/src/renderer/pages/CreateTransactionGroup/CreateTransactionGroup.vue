<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import EmptyTransactionGroup from '@renderer/components/EmptyTransactionGroup.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';
import { useRouter } from 'vue-router';

/* Stores */
const transactionGroup = useTransactionGroupStore();

/* Composables */
const router = useRouter();

/* State */
const groupName = ref('');
const groupEmpty = ref(transactionGroup.groupItems.length == 0);
const isTransactionSelectionModalShown = ref(false);

function handleSaveGroup() {
  console.log('hello');
}

function handleDeleteGroupItem(index: number) {
  transactionGroup.removeGroupItem(index);
}

function handleDuplicateGroupItem(index: number) {
  transactionGroup.duplicateGroupItem(index);
}

function handleEditGroupItem(index: number, type: string) {
  router.push({
    name: 'createTransaction',
    params: { type },
    query: { groupIndex: index, group: 'true' },
  });
}
</script>
<template>
  <div class="p-5">
    <div class="d-flex align-items-center">
      <AppButton
        type="button"
        color="secondary"
        class="btn-icon-only me-4"
        @click="$router.push('transactions')"
      >
        <i class="bi bi-arrow-left"></i>
      </AppButton>

      <h2 class="text-title text-bold">Create Transaction Group</h2>
    </div>
    <form class="mt-5" @submit.prevent="handleSaveGroup">
      <div class="form-group col-6">
        <label class="form-label">Transaction Group Name</label>
        <AppInput v-model="groupName" filled placeholder="Enter Name" />
      </div>
      <hr class="separator my-5 w-100" />
      <div class="d-flex justify-content-between">
        <div />
        <AppButton
          type="button"
          class="text-main text-primary"
          @click="isTransactionSelectionModalShown = true"
          ><i class="bi bi-plus-lg"></i> <span>Add Transaction</span></AppButton
        >
      </div>
      <hr class="separator my-5 w-100" />
      <div v-if="!groupEmpty">
        <div
          v-for="(groupItem, index) in transactionGroup.groupItems"
          :key="groupItem.transactionBytes"
        >
          <div class="d-flex justify-content-between p-4" style="background-color: #edefff">
            <div>
              <div>{{ groupItem.type }}</div>
              <div>{{ groupItem.accountId }}</div>
            </div>
            <div class="d-flex">
              <AppButton
                type="button"
                class="text-black"
                @click="handleDeleteGroupItem(index)"
                style="min-width: 0"
                >Delete
              </AppButton>
              <AppButton
                type="button"
                class="text-black"
                @click="handleDuplicateGroupItem(index)"
                style="min-width: 0"
                >Duplicate
              </AppButton>
              <AppButton
                type="button"
                class="text-black"
                @click="handleEditGroupItem(index, groupItem.type)"
                style="background-color: #dcdfff; min-width: 0"
              >
                Edit
              </AppButton>
            </div>
          </div>
        </div>
        <AppButton color="primary" type="submit" class="mt-5">Save Group</AppButton>
      </div>
    </form>
    <div v-if="groupEmpty">
      <EmptyTransactionGroup class="absolute-centered w-100" />
    </div>
    <TransactionSelectionModal v-model:show="isTransactionSelectionModalShown" group />
  </div>
</template>
