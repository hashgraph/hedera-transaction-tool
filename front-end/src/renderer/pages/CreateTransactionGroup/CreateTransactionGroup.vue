<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  Hbar,
  KeyList,
  PublicKey,
  TransferTransaction,
  Transaction,
  HbarUnit,
} from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useToast } from 'vue-toast-notification';
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';

import { deleteGroup } from '@renderer/services/transactionGroupsService';

import {
  assertUserLoggedIn,
  formatHbarTransfers,
  getErrorMessage,
  getPropagationButtonLabel,
  isLoggedInOrganization,
  redirectToPreviousTransactionsTab,
} from '@renderer/utils';
import { createTransactionId } from '@renderer/utils/sdk';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';
import TransactionGroupProcessor from '@renderer/components/Transaction/TransactionGroupProcessor.vue';
import SaveTransactionGroupModal from '@renderer/components/modals/SaveTransactionGroupModal.vue';
import RunningClockDatePicker from '@renderer/components/RunningClockDatePicker.vue';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';
import useNextTransactionV2, {
  type TransactionNodeId,
} from '@renderer/stores/storeNextTransactionV2.ts';

/* Stores */
const transactionGroup = useTransactionGroupStore();
const user = useUserStore();
const useNextTransaction = useNextTransactionV2();

/* Composables */
const router = useRouter();
const route = useRoute();
const toast = useToast();
const payerData = useAccountId();
const network = useNetworkStore();
useSetDynamicLayout(LOGGED_IN_LAYOUT);
const { dateTimeSettingLabel } = useDateTimeSetting();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();

/* State */
const groupDescription = ref('');
const isTransactionSelectionModalShown = ref(false);
const transactionGroupProcessor = ref<typeof TransactionGroupProcessor | null>(null);
const file = ref<HTMLInputElement | null>(null);
const wantToDeleteModalShown = ref(false);
const showAreYouSure = ref(false);
const updateValidStarts = ref(true);

const groupEmpty = computed(() => transactionGroup.groupItems.length == 0);

const transactionKey = computed(() => {
  return transactionGroup.getRequiredKeys();
});

/* Handlers */
async function saveTransactionGroup() {
  assertUserLoggedIn(user.personal);

  if (!groupDescription.value) {
    throw new Error('Please enter a group description');
  }

  if (transactionGroup.groupItems.length === 0) {
    throw new Error('Please add at least one transaction to the group');
  }

  await transactionGroup.saveGroup(
    user.personal.id,
    groupDescription.value,
    transactionGroup.groupValidStart,
  );
  transactionGroup.clearGroup();
}
async function handleSaveGroup() {
  await saveTransactionGroup();
  await redirectToPreviousTransactionsTab(router);
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
  router.push({
    name: 'transactions',
    query: {
      tab: router.previousTab,
    },
  });
}

async function handleDelete() {
  if (route.query.id) {
    await deleteGroup(route.query.id.toString());
  }
  transactionGroup.clearGroup();
  await redirectToPreviousTransactionsTab(router);
}

const handleLoadGroup = async () => {
  if (!route.query.id) {
    // transactionGroup.clearGroup();
    return;
  }

  assertUserLoggedIn(user.personal);

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
    toast.error('Group Description Required', errorToastOptions);
    return;
  }

  try {
    updateValidStarts.value = false;
    transactionGroup.updateTransactionValidStarts(transactionGroup.groupValidStart);
    const ownerKeys = new Array<PublicKey>();
    for (const key of user.keyPairs) {
      ownerKeys.push(PublicKey.fromString(key.public_key));
    }
    const requiredKey = new KeyList(ownerKeys);

    await transactionGroupProcessor.value?.process(requiredKey);
  } catch (error) {
    updateValidStarts.value = true;
    toast.error(getErrorMessage(error, 'Failed to create transaction'), errorToastOptions);
  }
}

async function handleExecuted(id: string) {
  transactionGroup.clearGroup();
  if (user.selectedOrganization) {
    const targetNodeId: TransactionNodeId = { groupId: id };
    await useNextTransaction.routeDown(targetNodeId, [targetNodeId], router);
  } else {
    await redirectToPreviousTransactionsTab(router);
  }
}

async function handleSubmit(id: number) {
  transactionGroup.clearGroup();
  const targetNodeId: TransactionNodeId = { groupId: id };
  await useNextTransaction.routeDown(targetNodeId, [targetNodeId], router);
}

function handleClose() {
  transactionGroup.clearGroup();
  redirectToPreviousTransactionsTab(router);
}

function handleOnImportClick() {
  if (file.value != null) {
    file.value.click();
  }
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function handleOnFileChanged(e: Event) {
  transactionGroup.clearGroup();
  const target = e.target as HTMLInputElement;
  const selectedFile = target.files?.[0];
  if (!selectedFile) return;

  try {
    const result = await readFileAsText(selectedFile);
    const rows = result.split(/\r?\n|\r|\n/g);
    let senderAccount = '';
    let feePayer = '';
    let sendingTime = '';
    let transactionFee = '';
    let txValidDuration = '';
    let memo = '';
    let validStart: Date | null = null;
    const maxTransactionFee = ref<Hbar>(new Hbar(2));

    for (const row of rows) {
      const rowInfo =
        row
          .match(/(?:"(?:\\"|[^"])*"|[^,]+)(?=,|$)/g)
          ?.map(s => s.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"')) || [];
      const title = rowInfo[0]?.toLowerCase();

      switch (title) {
        case 'transaction description':
          groupDescription.value = rowInfo[1];
          break;
        case 'sender account':
          senderAccount = rowInfo[1];
          try {
            await accountByIdCache.lookup(senderAccount, network.mirrorNodeBaseURL);
          } catch (error) {
            toast.error(
              `Sender account ${senderAccount} does not exist on network. Review the CSV file.`,
              errorToastOptions,
            );
            console.log(error);
            return;
          }
          break;
        case 'fee payer account':
          feePayer = rowInfo[1];
          try {
            await accountByIdCache.lookup(feePayer, network.mirrorNodeBaseURL);
          } catch (error) {
            toast.error(
              `Fee payer account ${feePayer} does not exist on network. Review the CSV file.`,
              errorToastOptions,
            );
            console.log(error);
            return;
          }
          break;
        case 'sending time':
          sendingTime = rowInfo[1];
          break;
        case 'node ids':
          break;
        case 'transaction fee':
          transactionFee = rowInfo[1];
          break;
        case 'transaction valid duration':
          txValidDuration = rowInfo[1];
          break;
        case 'memo':
          memo = rowInfo[1];
          break;
        case 'accountid':
        case 'account id':
          break;
        default: {
          if (row === '') {
            continue;
          }
          // Create the new validStart value, or add 1 millisecond to the existing one for subsequent transactions
          if (!validStart) {
            const startDate = rowInfo[2];
            validStart = new Date(`${startDate} ${sendingTime}`);
            if (validStart < new Date()) {
              validStart = new Date();
            }
          } else {
            validStart.setMilliseconds(validStart.getMilliseconds() + 1);
          }
          feePayer = feePayer || senderAccount;
          const receiverAccount = rowInfo[0];
          try {
            await accountByIdCache.lookup(receiverAccount, network.mirrorNodeBaseURL);
          } catch (error) {
            toast.error(
              `Receiver account ${receiverAccount} does not exist on network. Review the CSV file.`,
              errorToastOptions,
            );
            console.log(error);
            transactionGroup.clearGroup();
            return;
          }

          const transaction = new TransferTransaction()
            .setTransactionValidDuration(txValidDuration ? Number.parseInt(txValidDuration) : 180)
            .setMaxTransactionFee(
              (transactionFee
                ? new Hbar(transactionFee, HbarUnit.Tinybar)
                : maxTransactionFee.value) as Hbar,
            );

          transaction.setTransactionId(createTransactionId(feePayer, validStart));
          const transferAmount = rowInfo[1].replace(/,/g, '');
          transaction.addHbarTransfer(receiverAccount, new Hbar(transferAmount, HbarUnit.Tinybar));
          transaction.addHbarTransfer(senderAccount, new Hbar(-transferAmount, HbarUnit.Tinybar));
          // If memo is not provided for the row, use the memo from the header portion
          // otherwise check if the memo is not 'n/a' and set it
          if (rowInfo.length < 4 || !rowInfo[3]?.trim()) {
            transaction.setTransactionMemo(memo);
          } else if (!/^(n\/a)$/i.test(rowInfo[3])) {
            transaction.setTransactionMemo(rowInfo[3]);
          }

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
    toast.success('Import complete', successToastOptions);
  } catch (error) {
    toast.error('Failed to import CSV file', errorToastOptions);
    console.log(error);
  } finally {
    if (file.value != null) {
      file.value.value = '';
    }
  }
}

function updateGroupValidStart(newDate: Date) {
  transactionGroup.groupValidStart = newDate;
  if (updateValidStarts.value) {
    transactionGroup.updateTransactionValidStarts(transactionGroup.groupValidStart);
  }
}

/* Functions */
function makeTransfer(index: number) {
  const transfers = (
    Transaction.fromBytes(
      transactionGroup.groupItems[index].transactionBytes,
    ) as TransferTransaction
  ).hbarTransfersList;

  return formatHbarTransfers(transfers);
}

/* Hooks */
onMounted(async () => {
  await handleLoadGroup();
  groupDescription.value = transactionGroup.description;
});

onBeforeRouteLeave(async to => {
  if (to.name === 'transactionGroupDetails') {
    to.query = { ...to.query, previousTab: 'createGroup' };
  }

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

  return true;
});
</script>
<template>
  <div class="p-5">
    <div class="flex-column-100 overflow-hidden">
      <div class="d-flex align-items-center">
        <AppButton
          type="button"
          color="secondary"
          class="btn-icon-only me-4"
          data-testid="button-back"
          @click="handleBack"
        >
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
              data-testid="input-transaction-group-description"
            />
          </div>
          <div class="mt-4 align-self-end">
            <AppButton
              v-if="!groupEmpty"
              color="danger"
              type="button"
              @click="handleDeleteAll"
              class="ms-4 text-danger"
              data-testid="button-delete-all"
            >
              Delete All</AppButton
            >
            <AppButton color="primary" data-testid="button-save-group" type="submit" class="ms-4"
              >Save Group</AppButton
            >
            <AppButton
              color="primary"
              type="button"
              @click="handleSignSubmit"
              class="ms-4"
              data-testid="button-sign-submit"
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
            <AppButton
              type="button"
              data-testid="button-import-csv"
              class="text-main text-primary"
              @click="handleOnImportClick"
              >Import CSV</AppButton
            >
          </div>
          <div v-else />
          <AppButton
            type="button"
            class="text-main text-primary"
            @click="isTransactionSelectionModalShown = true"
            data-testid="button-add-transaction"
            ><i class="bi bi-plus-lg"></i> <span>Add Transaction</span>
          </AppButton>
        </div>
        <hr class="separator my-5 w-100" />
        <div v-if="!groupEmpty" class="fill-remaining pb-10">
          <div class="d-flex justify-content-between align-items-center mb-5">
            <div>
              <label class="form-label"
                >Group Valid Start<span class="text-muted text-italic">{{
                  ` - ${dateTimeSettingLabel}`
                }}</span></label
              >
              <RunningClockDatePicker
                :model-value="transactionGroup.groupValidStart"
                @update:modelValue="updateGroupValidStart"
                :nowButtonVisible="true"
              />
            </div>
            <div>
              {{
                transactionGroup.groupItems.length < 2
                  ? `1 Transaction`
                  : `${transactionGroup.groupItems.length} Transactions`
              }}
            </div>
          </div>
          <div
            v-for="(groupItem, index) in transactionGroup.groupItems"
            :key="groupItem.transactionBytes.toString()"
            class="pb-3"
          >
            <div class="d-flex justify-content-between p-4 transaction-group-row">
              <div class="align-self-center col">
                <div :data-testid="'span-transaction-type-' + index">{{ groupItem.type }}</div>
              </div>
              <div
                class="align-self-center text-truncate col text-center mx-5"
                :data-testid="'span-transaction-timestamp-' + index"
                v-html="
                  groupItem.type == 'Transfer Transaction'
                    ? makeTransfer(index)
                    : groupItem.description != ''
                      ? groupItem.description
                      : Transaction.fromBytes(groupItem.transactionBytes).transactionMemo
                        ? Transaction.fromBytes(groupItem.transactionBytes).transactionMemo
                        : createTransactionId(groupItem.payerAccountId, groupItem.validStart)
                "
              ></div>
              <div class="d-flex col justify-content-end">
                <AppButton
                  type="button"
                  class="transaction-group-button-borderless"
                  @click="handleDeleteGroupItem(index)"
                  style="min-width: 0"
                  :data-testid="'button-transaction-delete-' + index"
                  >Delete
                </AppButton>
                <AppButton
                  type="button"
                  class="transaction-group-button-borderless"
                  @click="handleDuplicateGroupItem(index)"
                  style="min-width: 0"
                  :data-testid="'button-transaction-duplicate-' + index"
                  >Duplicate
                </AppButton>
                <AppButton
                  type="button"
                  class="transaction-group-button"
                  :data-testid="'button-transaction-edit-' + index"
                  @click="handleEditGroupItem(index, groupItem.type)"
                >
                  Edit
                </AppButton>
              </div>
            </div>
          </div>
        </div>
        <template v-if="groupEmpty">
          <div class="fill-remaining flex-centered">
            <EmptyTransactions :mode="'create-group'" />
          </div>
        </template>
      </form>

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
        @abort="updateValidStarts = true"
      >
        <template #successHeading>Transaction Group Executed Successfully</template>
      </TransactionGroupProcessor>
    </div>

    <SaveTransactionGroupModal :save-transaction-group="saveTransactionGroup" />

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
          <AppButton color="primary" data-testid="button-continue-editing" type="submit">
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
            data-testid="button-confirm-delete-all"
          >
            Confirm</AppButton
          >
        </div>
      </div>
    </AppModal>
  </div>
</template>
