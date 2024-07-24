<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';
import TransactionGroupProcessor from '@renderer/components/Transaction/TransactionGroupProcessor.vue';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';
import { useRouter, useRoute } from 'vue-router';
import useUserStore from '@renderer/stores/storeUser';
import { isUserLoggedIn } from '@renderer/utils/userStoreHelpers';
import { getEntityIdFromTransactionReceipt, getPropagationButtonLabel } from '@renderer/utils';
import { KeyList, PublicKey, Transaction } from '@hashgraph/sdk';
import { useToast } from 'vue-toast-notification';
import { createTransactionId } from '@renderer/services/transactionService';

/* Stores */
const transactionGroup = useTransactionGroupStore();
const user = useUserStore();

/* Composables */
const router = useRouter();
const route = useRoute();
const toast = useToast();

/* State */
const groupName = ref('');
const isTransactionSelectionModalShown = ref(false);
const transactionGroupProcessor = ref<typeof TransactionGroupProcessor | null>(null);

const groupEmpty = computed(() => transactionGroup.groupItems.length == 0);

const transactionKey = computed(() => {
  return transactionGroup.getRequiredKeys();
});

/* Handlers */
function handleSaveGroup() {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  addTransactionIds();

  transactionGroup.saveGroup(
    user.personal.id,
    groupName.value,
    transactionGroup.groupItems[0].groupId,
  );
  transactionGroup.clearGroup();
  router.push('transactions');
}

function nameUpdated() {
  transactionGroup.description = groupName.value;
}

function handleDeleteGroupItem(index: number) {
  transactionGroup.removeGroupItem(index);
}

function handleDuplicateGroupItem(index: number) {
  transactionGroup.duplicateGroupItem(index);
}

function handleEditGroupItem(index: number, type: string) {
  type = type.replace(/\s/g, '');
  router.push({
    name: 'createTransaction',
    params: { type, seq: index },
    query: { groupIndex: index, group: 'true' },
  });
}

function handleBack() {
  if (route.query.id) {
    transactionGroup.clearGroup();
  }
  router.push('transactions');
}

const handleLoadGroup = async () => {
  if (!route.query.id) {
    // transactionGroup.clearGroup();
    return;
  }

  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  await transactionGroup.fetchGroup(route.query.id.toString(), {
    where: {
      user_id: user.personal.id,
      GroupItem: {
        every: {
          transaction_group_id: route.query.id.toString(),
        },
      },
    },
  });
};

async function handleSignSubmit() {
  try {
    const ownerKey = PublicKey.fromString(user.keyPairs[0].public_key);

    const requiredKey = new KeyList([ownerKey]);
    addTransactionIds();
    await transactionGroupProcessor.value?.process(requiredKey);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
}

function handleExecuted(id: number) {
  router.push({
    name: 'transactionGroupDetails',
    params: { id },
  });
}

function handleSubmit(id: number) {
  router.push({
    name: 'transactionGroupDetails',
    params: { id },
  });
}

function handleClose() {
  transactionGroup.clearGroup();
  router.push({ name: 'transactions' });
}

function addTransactionIds() {
  for (const groupItem of transactionGroup.groupItems) {
    const transaction = Transaction.fromBytes(groupItem.transactionBytes);
    transaction.setTransactionId(
      createTransactionId(groupItem.payerAccountId, groupItem.validStart),
    );
  }
}
/* Hooks */
onMounted(async () => {
  await handleLoadGroup();
  groupName.value = transactionGroup.description;
});
</script>
<template>
  <div class="p-5 overflow-y-auto">
    <div class="d-flex align-items-center">
      <AppButton type="button" color="secondary" class="btn-icon-only me-4" @click="handleBack">
        <i class="bi bi-arrow-left"></i>
      </AppButton>

      <h2 class="text-title text-bold">Create Transaction Group</h2>
    </div>
    <form class="mt-5" @submit.prevent="handleSaveGroup">
      <div class="form-group col-6">
        <label class="form-label">Transaction Group Name</label>
        <AppInput
          v-model="groupName"
          @update:modelValue="nameUpdated"
          filled
          placeholder="Enter Name"
        />
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
          :key="groupItem.transactionBytes.toString()"
        >
          <div class="d-flex justify-content-between p-4 transaction-group-row">
            <div>
              <div>{{ groupItem.type }}</div>
              <div>{{ groupItem.accountId }}</div>
            </div>
            <div class="d-flex">
              <AppButton
                type="button"
                class="transaction-group-button-borderless"
                @click="handleDeleteGroupItem(index)"
                style="min-width: 0"
                >Delete
              </AppButton>
              <AppButton
                type="button"
                class="transaction-group-button-borderless"
                @click="handleDuplicateGroupItem(index)"
                style="min-width: 0"
                >Duplicate
              </AppButton>
              <AppButton
                type="button"
                class="transaction-group-button"
                @click="handleEditGroupItem(index, groupItem.type)"
              >
                Edit
              </AppButton>
            </div>
          </div>
        </div>
        <div class="mt-5">
          <AppButton color="primary" type="submit">Save Group</AppButton>
          <AppButton color="primary" type="button" @click="handleSignSubmit" class="ms-4">
            <span class="bi bi-send"></span>
            {{
              getPropagationButtonLabel(
                transactionKey,
                user.keyPairs,
                Boolean(user.selectedOrganization),
              )
            }}</AppButton
          >
        </div>
      </div>
    </form>
    <div v-if="groupEmpty">
      <EmptyTransactions class="absolute-centered w-100" />
    </div>
    <TransactionSelectionModal v-model:show="isTransactionSelectionModalShown" group />
    <TransactionGroupProcessor
      ref="transactionGroupProcessor"
      :on-close-success-modal-click="handleClose"
      :on-executed="handleExecuted"
      :on-submitted="handleSubmit"
    >
      <template #successHeading>Transaction Group Executed Successfully</template>
    </TransactionGroupProcessor>
  </div>
</template>
