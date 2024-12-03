<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Hbar, KeyList, PublicKey, TransferTransaction, Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useToast } from 'vue-toast-notification';
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';
import useSetDynamicLayout from '@renderer/composables/useSetDynamicLayout';

import { deleteGroup } from '@renderer/services/transactionGroupsService';

import {
  getErrorMessage,
  getPropagationButtonLabel,
  isLoggedInOrganization,
  isUserLoggedIn,
  redirectToGroupDetails,
} from '@renderer/utils';
import { createTransactionId } from '@renderer/utils/sdk';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';
import TransactionGroupProcessor from '@renderer/components/Transaction/TransactionGroupProcessor.vue';

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
const groupDescription = ref('');
const isTransactionSelectionModalShown = ref(false);
const transactionGroupProcessor = ref<typeof TransactionGroupProcessor | null>(null);
const file = ref<HTMLInputElement | null>(null);
const isSaveGroupModalShown = ref(false);
const wantToDeleteModalShown = ref(false);
const showAreYouSure = ref(false);

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

  if (groupDescription.value.trim() === '') {
    toast.error('Please enter a group description');
    return;
  }

  await transactionGroup.saveGroup(user.personal.id, groupDescription.value);
  transactionGroup.clearGroup();
  router.push('transactions');
}

function descriptionUpdated() {
  transactionGroup.description = groupDescription.value;
  transactionGroup.setModified();
}

function handleSequentialChange(value: boolean) {
  transactionGroup.sequential = value;
  transactionGroup.setModified();
}

function handleDeleteGroupItem(index: number) {
  transactionGroup.removeGroupItem(index);
}

function handleDeleteAll() {
  showAreYouSure.value = true;
}

function handleConfirmDeleteAll() {
  transactionGroup.clearGroup();
  showAreYouSure.value = false;
}

function handleCancelDeleteAll() {
  showAreYouSure.value = false;
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
  if (groupDescription.value.trim() === '') {
    toast.error('Group Description Required');
    return;
  }

  try {
    const ownerKeys = new Array<PublicKey>();
    for (const key of user.keyPairs) {
      ownerKeys.push(PublicKey.fromString(key.public_key));
    }
    const requiredKey = new KeyList(ownerKeys);

    await transactionGroupProcessor.value?.process(requiredKey);
  } catch (err: unknown) {
    toast.error(getErrorMessage(err, 'Failed to create transaction'));
  }
}

function handleExecuted(id: string) {
  transactionGroup.clearGroup();
  if (user.selectedOrganization) {
    redirectToGroupDetails(router, id);
  } else {
    router.push({ name: 'transactions' });
  }
}

function handleSubmit(id: number) {
  transactionGroup.clearGroup();
  redirectToGroupDetails(router, id);
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
    let feePayer = '';
    let sendingTime = '';
    let transactionFee = '';
    let txValidDuration = '';
    let memo = '';
    let validStart: Date | null = null;
    for (const row of rows) {
      const title = row.split(',')[0].toLowerCase();
      switch (title) {
        case 'sender account':
          senderAccount = row.split(',')[1];
          break;
        case 'fee payer account':
          feePayer = row.split(',')[1];
          break;
        case 'sending time':
          sendingTime = row.split(',')[1];
          break;
        case 'node ids':
          break;
        case 'transaction fee':
          transactionFee = row.split(',')[1];
          break;
        case 'transaction valid duration':
          txValidDuration = row.split(',')[1];
          break;
        case 'memo':
          memo = row.split(',')[1];
          break;
        case 'accountid':
        case 'account id':
          break;
        default: {
          if (row === '') {
            console.log();
          } else {
            // Create the new validStart value, or add 1 millisecond to the existing one for subsequent transactions
            if (!validStart) {
              const startDate = row.split(',')[2];
              validStart = new Date(`${startDate} ${sendingTime}`);
              if (validStart < new Date()) {
                validStart = new Date();
              }
            } else {
              validStart.setMilliseconds(validStart.getMilliseconds() + 1);
            }
            const transaction = new TransferTransaction()
              .setTransactionValidDuration(txValidDuration ? Number.parseInt(txValidDuration) : 180)
              .setMaxTransactionFee(
                transactionFee ? new Hbar(transactionFee) : maxTransactionFee.value,
              );

            transaction.setTransactionId(
              createTransactionId(feePayer ? feePayer : senderAccount, validStart),
            );
            transaction.addHbarTransfer(row.split(',')[0], row.split(',')[1]);
            transaction.addHbarTransfer(senderAccount, Number.parseFloat(row.split(',')[1]) * -1);
            transaction.setTransactionMemo(memo);

            const transactionBytes = transaction.toBytes();
            const keys = new Array<string>();
            if (payerData.key.value instanceof KeyList) {
              for (const key of payerData.key.value.toArray()) {
                keys.push(key.toString());
              }
            }
            transactionGroup.addGroupItem({
              transactionBytes,
              type: 'Transfer Transaction',
              seq: transactionGroup.groupItems.length.toString(),
              keyList: keys,
              observers: [],
              approvers: [],
              payerAccountId: feePayer ? feePayer : senderAccount,
              validStart: new Date(validStart.getTime()),
              description: '',
            });
          }
        }
      }
    }
  };

  if (file.value != null) {
    file.value.value = '';
  }
}

/* Functions */
function makeTransfer(index: number) {
  const transfers = (
    Transaction.fromBytes(
      transactionGroup.groupItems[index].transactionBytes,
    ) as TransferTransaction
  ).hbarTransfersList;
  const transfer =
    transfers.length == 2
      ? `${transfers[0].accountId} --> ${transfers[1].amount} --> ${transfers[1].accountId}`
      : 'Multiple Transfers';

  return transfer;
}

/* Hooks */
onMounted(async () => {
  await handleLoadGroup();
  groupDescription.value = transactionGroup.description;
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
  <div class="p-5">
    <div class="flex-column-100 overflow-hidden">
      <div class="d-flex align-items-center">
        <AppButton type="button" color="secondary" class="btn-icon-only me-4" @click="handleBack">
          <i class="bi bi-arrow-left"></i>
        </AppButton>

        <h2 class="text-title text-bold">Create Transaction Group</h2>
      </div>
      <form class="mt-5 flex-column-100" @submit.prevent="handleSaveGroup">
        <div class="d-flex justify-content-between">
          <div class="form-group col">
            <label class="form-label"
              >Transaction Group Description <span class="text-danger">*</span></label
            >
            <AppInput
              v-model="groupDescription"
              @update:modelValue="descriptionUpdated"
              filled
              placeholder="Enter Description"
            />
          </div>
          <div class="mt-4 align-self-end">
            <AppButton
              v-if="!groupEmpty"
              color="danger"
              type="button"
              @click="handleDeleteAll"
              class="ms-4 text-danger"
            >
              Delete All</AppButton
            >
            <AppButton color="primary" type="submit" class="ms-4">Save Group</AppButton>
            <AppButton
              color="primary"
              type="button"
              @click="handleSignSubmit"
              class="ms-4"
              :disabled="transactionGroup.groupItems.length == 0"
            >
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
        <div
          v-if="isLoggedInOrganization(user.selectedOrganization)"
          class="d-flex justify-content-between mt-4"
        >
          <div class="form-group col">
            <AppCheckBox
              :checked="transactionGroup.sequential"
              @update:checked="handleSequentialChange"
              label="Sequential execution"
              name="sequential-execution"
              data-testid="checkbox-sequential-execution"
            />
          </div>
        </div>
        <hr class="separator my-5 w-100" />
        <div class="d-flex justify-content-between">
          <div v-if="user.selectedOrganization">
            <input type="file" accept=".csv" ref="file" @change="handleOnFileChanged" />
            <AppButton type="button" class="text-main text-primary" @click="handleOnImportClick"
              >Import CSV</AppButton
            >
          </div>
          <div v-else />
          <AppButton
            type="button"
            class="text-main text-primary"
            @click="isTransactionSelectionModalShown = true"
            ><i class="bi bi-plus-lg"></i> <span>Add Transaction</span>
          </AppButton>
        </div>
        <hr class="separator my-5 w-100" />
        <div v-if="!groupEmpty" class="fill-remaining pb-10">
          <div class="text-end mb-5">
            {{
              transactionGroup.groupItems.length < 2
                ? `1 Transaction`
                : `${transactionGroup.groupItems.length} Transactions`
            }}
          </div>
          <div
            v-for="(groupItem, index) in transactionGroup.groupItems"
            :key="groupItem.transactionBytes.toString()"
            class="pb-3"
          >
            <div class="d-flex justify-content-between p-4 transaction-group-row">
              <div class="align-self-center col">
                <div>{{ groupItem.type }}</div>
              </div>
              <div class="align-self-center text-truncate col text-center mx-5">
                {{
                  groupItem.type == 'Transfer Transaction'
                    ? makeTransfer(index)
                    : groupItem.description != ''
                      ? groupItem.description
                      : Transaction.fromBytes(groupItem.transactionBytes).transactionMemo
                        ? Transaction.fromBytes(groupItem.transactionBytes).transactionMemo
                        : createTransactionId(groupItem.payerAccountId, groupItem.validStart)
                }}
              </div>
              <div class="d-flex col justify-content-end">
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
        </div>
      </form>
      <div v-if="groupEmpty">
        <EmptyTransactions class="absolute-centered w-100" group />
      </div>
      <TransactionSelectionModal
        v-if="isTransactionSelectionModalShown"
        v-model:show="isTransactionSelectionModalShown"
        group
      />
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
            data-testid="button-discard-group-modal"
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
            data-testid="button-delete-group-modal"
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
    <AppModal
      :show="showAreYouSure"
      :close-on-click-outside="false"
      :close-on-escape="false"
      class="small-modal"
    >
      <div class="text-center p-4">
        <div class="text-start">
          <i class="bi bi-x-lg cursor-pointer" @click="showAreYouSure = false"></i>
        </div>
        <h2 class="text-title text-semi-bold mt-3">
          Are you sure you want to delete all transactions?
        </h2>
        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" type="button" @click="handleCancelDeleteAll">
            Cancel</AppButton
          >
          <AppButton
            color="danger"
            type="button"
            @click="handleConfirmDeleteAll"
            class="text-danger"
          >
            Confirm</AppButton
          >
        </div>
      </div>
    </AppModal>
  </div>
</template>
