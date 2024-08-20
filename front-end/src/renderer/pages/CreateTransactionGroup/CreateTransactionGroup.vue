<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Hbar, KeyList, PublicKey, Transaction, TransferTransaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useToast } from 'vue-toast-notification';
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';
import useSetDynamicLayout from '@renderer/composables/useSetDynamicLayout';

import { createTransactionId } from '@renderer/services/transactionService';

import { getPropagationButtonLabel } from '@renderer/utils';
import { isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';
import TransactionGroupProcessor from '@renderer/components/Transaction/TransactionGroupProcessor.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import { deleteGroup } from '@renderer/services/transactionGroupsService';

/* Stores */
const transactionGroup = useTransactionGroupStore();
const user = useUserStore();

/* Composables */
const router = useRouter();
const route = useRoute();
const toast = useToast();
const payerData = useAccountId();
useSetDynamicLayout({
  loggedInClass: true,
  shouldSetupAccountClass: false,
  showMenu: true,
});

/* State */
const groupName = ref('');
const isTransactionSelectionModalShown = ref(false);
const transactionGroupProcessor = ref<typeof TransactionGroupProcessor | null>(null);
const file = ref<HTMLInputElement | null>(null);
const isSaveGroupModalShown = ref(false);
const wantToDeleteModalShown = ref(false);

const groupEmpty = computed(() => transactionGroup.groupItems.length == 0);

const transactionKey = computed(() => {
  return transactionGroup.getRequiredKeys();
});

/* Handlers */
async function handleSaveGroup() {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  if (isSaveGroupModalShown.value) {
    isSaveGroupModalShown.value = false;
  }

  addTransactionIds();

  await transactionGroup.saveGroup(user.personal.id, groupName.value);
  transactionGroup.clearGroup();
  router.push('transactions');
}

function nameUpdated() {
  transactionGroup.description = groupName.value;
  transactionGroup.setModified();
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
  router.push('transactions');
}

async function handleDiscard() {
  transactionGroup.clearGroup();
  router.push('transactions');
}

async function handleDelete() {
  if (route.query.id) {
    await deleteGroup(route.query.id.toString());
  }
  transactionGroup.clearGroup();
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
    const ownerKeys = new Array<PublicKey>();
    for (const key of user.keyPairs) {
      ownerKeys.push(PublicKey.fromString(key.public_key));
    }
    const requiredKey = new KeyList(ownerKeys);
    addTransactionIds();
    await transactionGroupProcessor.value?.process(requiredKey);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
}

function handleExecuted(id: string) {
  transactionGroup.clearGroup();
  if (user.selectedOrganization) {
    router.push({
      name: 'transactionGroupDetails',
      params: { id },
    });
  } else {
    router.push({ name: 'transactions' });
  }
}

function handleSubmit(id: number) {
  transactionGroup.clearGroup();
  router.push({
    name: 'transactionGroupDetails',
    params: { id },
  });
}

function handleClose() {
  transactionGroup.clearGroup();
  router.push({ name: 'transactions' });
}

function handleOnImportClick() {
  if (file.value != null) {
    file.value.click();
  }
}

async function handleOnFileChanged(e: Event) {
  transactionGroup.clearGroup();
  const reader = new FileReader();
  const maxTransactionFee = ref<Hbar>(new Hbar(2));
  const target = e.target as HTMLInputElement;
  reader.readAsText(target.files![0]);
  reader.onload = () => {
    const result = (reader.result as string).replace(/['"]+/g, '');
    const rows = result.split(/\r?\n|\r|\n/g);
    let senderAccount = '';
    let sendingTime = '';
    for (const row of rows) {
      if (row.startsWith('Sender Account')) {
        senderAccount = row.split(',')[1];
      } else if (row.startsWith('Sending Time')) {
        sendingTime = row.split(',')[1];
      } else if (row.startsWith('Node IDs')) {
        console.log();
      } else if (row.startsWith('AccountID')) {
        console.log();
      } else if (row === '') {
        console.log();
      } else {
        const startDate = row.split(',')[2];
        const validStart = new Date(`${startDate} ${sendingTime}`);
        const transaction = new TransferTransaction()
          .setTransactionValidDuration(180)
          .setMaxTransactionFee(maxTransactionFee.value);

        transaction.setTransactionId(createTransactionId(senderAccount, validStart));
        transaction.addHbarTransfer(row.split(',')[0], row.split(',')[1]);
        transaction.addHbarTransfer(senderAccount, Number.parseFloat(row.split(',')[1]) * -1);
        transaction.setTransactionMemo(row.split(',')[3]);

        const transactionBytes = transaction.toBytes();
        const keys = new Array<string>();
        if (payerData.key.value instanceof KeyList) {
          for (const key of payerData.key.value.toArray()) {
            keys.push(key.toString());
          }
        }
        transactionGroup.addGroupItem({
          transactionBytes: transactionBytes,
          type: 'TransferTransaction',
          accountId: '',
          seq: transactionGroup.groupItems.length.toString(),
          keyList: keys,
          observers: [],
          approvers: [],
          payerAccountId: payerData.accountId.value,
          validStart: validStart,
        });
      }
    }
  };
}

function addTransactionIds() {
  for (const groupItem of transactionGroup.groupItems) {
    const transaction = Transaction.fromBytes(groupItem.transactionBytes);
    transaction.setTransactionId(
      createTransactionId(groupItem.payerAccountId, groupItem.validStart),
    );
    groupItem.transactionBytes = transaction.toBytes();
  }
}
/* Hooks */
onMounted(async () => {
  await handleLoadGroup();
  groupName.value = transactionGroup.description;
});

// onBeforeRouteLeave(async to => {
onBeforeRouteLeave(async to => {
  if (
    transactionGroup.isModified() &&
    transactionGroup.groupItems.length == 0 &&
    !to.fullPath.startsWith('/create-transaction/')
  ) {
    wantToDeleteModalShown.value = true;
    return false;
  }

  if (transactionGroup.groupItems.length == 0 && !transactionGroup.description) {
    transactionGroup.clearGroup();
    return true;
  }

  if (to.fullPath.startsWith('/create-transaction/')) {
    return true;
  }

  if (transactionGroup.isModified()) {
    isSaveGroupModalShown.value = true;
    return false;
  } else {
    transactionGroup.clearGroup();
  }

  return true;
});
</script>
<template>
  <div>
    <div class="p-5 overflow-y-auto" style="height: 100%">
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
          <div>
            <input type="file" accept=".csv" ref="file" @change="handleOnFileChanged" />
            <AppButton type="button" class="text-main text-primary" @click="handleOnImportClick"
              >Import CSV</AppButton
            >
          </div>
          <AppButton
            type="button"
            class="text-main text-primary"
            @click="isTransactionSelectionModalShown = true"
            ><i class="bi bi-plus-lg"></i> <span>Add Transaction</span>
          </AppButton>
        </div>
        <hr class="separator my-5 w-100" />
        <div v-if="!groupEmpty">
          <div
            v-for="(groupItem, index) in transactionGroup.groupItems"
            :key="groupItem.transactionBytes.toString()"
            class="pb-3"
          >
            <div class="d-flex justify-content-between p-4 transaction-group-row">
              <div class="align-self-center">
                <div>{{ groupItem.type }}</div>
                <div v-if="groupItem.accountId">{{ groupItem.accountId }}</div>
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
          <div class="mt-4">
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
        <EmptyTransactions class="absolute-centered w-100" group />
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

    <AppModal
      :show="isSaveGroupModalShown"
      :close-on-click-outside="false"
      :close-on-escape="false"
      class="small-modal"
    >
      <form class="text-center p-4" @submit.prevent="handleSaveGroup">
        <div class="text-start">
          <i class="bi bi-x-lg cursor-pointer" @click="isSaveGroupModalShown = false"></i>
        </div>
        <div>
          <AppCustomIcon :name="'lock'" style="height: 160px" />
        </div>
        <h2 class="text-title text-semi-bold mt-3">Save Group?</h2>
        <p class="text-small text-secondary mt-3">
          Pick up exactly where you left off, without compromising your flow or losing valuable
          time.
        </p>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton
            color="borderless"
            data-testid="button-discard-draft-modal"
            type="button"
            @click="handleDiscard"
            >Discard</AppButton
          >
          <AppButton color="primary" data-testid="button-save-draft-modal" type="submit"
            >Save</AppButton
          >
        </div>
      </form>
    </AppModal>
    <AppModal
      :show="wantToDeleteModalShown"
      :close-on-click-outside="false"
      :close-on-escape="false"
      class="small-modal"
    >
      <form class="text-center p-4" @submit.prevent="wantToDeleteModalShown = false">
        <div class="text-start">
          <i class="bi bi-x-lg cursor-pointer" @click="wantToDeleteModalShown = false"></i>
        </div>
        <h2 class="text-title text-semi-bold mt-3">Group Contains No Transactions</h2>
        <p class="text-small text-secondary mt-3">Would you like to delete this group?</p>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton
            color="borderless"
            data-testid="button-discard-draft-modal"
            type="button"
            @click="handleDelete"
          >
            Delete Group
          </AppButton>
          <AppButton color="primary" data-testid="button-save-draft-modal" type="submit">
            Continue Editing
          </AppButton>
        </div>
      </form>
    </AppModal>
  </div>
</template>
