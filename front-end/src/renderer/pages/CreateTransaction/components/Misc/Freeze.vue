<script setup lang="ts">
import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import { computed, onMounted, ref, watch } from 'vue';
import { Hbar, FreezeTransaction, AccountId, Key, KeyList } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useToast } from 'vue-toast-notification';
import { useRoute, useRouter } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { getDraft } from '@renderer/services/transactionDraftsService';
import { uint8ArrayToHex } from '@renderer/services/electronUtilsService';

import {
  getPropagationButtonLabel,
  getTransactionFromBytes,
  isAccountId,
  isFileId,
  formatAccountId,
  redirectToDetails,
} from '@renderer/utils';
import { createFreezeTransaction } from '@renderer/utils/sdk/createTransactions';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionInfoControls from '@renderer/components/Transaction/TransactionInfoControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';
import RunningClockDatePicker from '@renderer/components/Wrapped/RunningClockDatePicker.vue';
import AddToGroupModal from '@renderer/components/AddToGroupModal.vue';

/* Stores */
const user = useUserStore();
const transactionGroup = useTransactionGroupStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const route = useRoute();

const payerData = useAccountId();

/* State */
const transactionProcessor = ref<InstanceType<typeof TransactionProcessor> | null>(null);

const transaction = ref<FreezeTransaction | null>(null);
const validStart = ref(new Date());
const maxTransactionFee = ref<Hbar>(new Hbar(2));

const freezeType = ref(-1);
const startTimestamp = ref(new Date());
const fileId = ref<string>('');
const fileHash = ref('');

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const isExecuted = ref(false);
const isSubmitted = ref(false);

const transactionMemo = ref('');
const transactionName = ref('');
const transactionDescription = ref('');

/* Computed */
const transactionKey = computed(() => {
  const keyList: Key[] = [];

  payerData.key.value && keyList.push(payerData.key.value);

  return new KeyList(keyList);
});

/* Handlers */
const handleCreate = async (e: Event) => {
  e.preventDefault();

  try {
    if (!isAccountId(payerData.accountId.value)) {
      throw new Error('Invalid Payer ID');
    }

    transaction.value = createTransaction();
    await transactionProcessor.value?.process(
      {
        transactionKey: transactionKey.value,
        transactionBytes: transaction.value.toBytes(),
        name: transactionName.value,
        description: transactionDescription.value,
      },
      observers.value,
      approvers.value,
    );
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleLoadFromDraft = async () => {
  if (!router.currentRoute.value.query.draftId && !route.query.groupIndex) return;
  let draftTransactionBytes: string | null = null;
  if (!route.query.group) {
    const draft = await getDraft(router.currentRoute.value.query.draftId?.toString() || '');
    draftTransactionBytes = draft.transactionBytes;
  } else if (route.query.groupIndex) {
    draftTransactionBytes =
      transactionGroup.groupItems[Number(route.query.groupIndex)].transactionBytes.toString();
  }

  if (draftTransactionBytes) {
    const draftTransaction = getTransactionFromBytes<FreezeTransaction>(draftTransactionBytes);
    transaction.value = draftTransaction;
    transactionMemo.value = draftTransaction.transactionMemo || '';

    if (draftTransaction.startTimestamp) {
      startTimestamp.value = draftTransaction.startTimestamp.toDate();
    }

    if (isFileId(draftTransaction.fileId?.toString() || '')) {
      fileId.value = draftTransaction.fileId?.toString() || '';
    }

    if (draftTransaction.fileHash) {
      fileHash.value = await uint8ArrayToHex(draftTransaction.fileHash);
    }
  }
};

const handleExecuted = () => {
  isExecuted.value = true;
};

const handleLocalStored = (id: string) => {
  toast.success('Freeze Transaction Executed', { position: 'bottom-right' });
  redirectToDetails(router, id);
};

const handleSubmit = (id: number) => {
  isSubmitted.value = true;
  redirectToDetails(router, id);
};

function handleAddToGroup() {
  if (!isAccountId(payerData.accountId.value)) {
    throw new Error('Invalid Payer ID');
  }

  const transactionBytes = createTransaction().toBytes();
  const keys = new Array<string>();
  if (payerData.key.value instanceof KeyList) {
    for (const key of payerData.key.value.toArray()) {
      keys.push(key.toString());
    }
  }

  transactionGroup.addGroupItem({
    transactionBytes: transactionBytes,
    type: 'FileCreateTransaction',
    accountId: '',
    seq: transactionGroup.groupItems.length.toString(),
    keyList: keys,
    observers: observers.value,
    approvers: approvers.value,
    payerAccountId: payerData.accountId.value,
    validStart: validStart.value,
  });
  router.push({ name: 'createTransactionGroup' });
}

function handleEditGroupItem() {
  const transactionBytes = createTransaction().toBytes();
  const keys = new Array<string>();
  if (payerData.key.value instanceof KeyList) {
    for (const key of payerData.key.value.toArray()) {
      keys.push(key.toString());
    }
  }

  transactionGroup.editGroupItem({
    transactionBytes: transactionBytes,
    type: 'FreezeTransaction',
    accountId: '',
    seq: route.params.seq[0],
    groupId: transactionGroup.groupItems[Number(route.query.groupIndex)].groupId,
    keyList: keys,
    observers: observers.value,
    approvers: approvers.value,
    payerAccountId: payerData.accountId.value,
    validStart: validStart.value,
  });
  router.push({ name: 'createTransactionGroup' });
}

/* Hooks */
onMounted(async () => {
  await handleLoadFromDraft();
});

/* Functions */
function createTransaction() {
  return createFreezeTransaction({
    payerId: payerData.accountId.value,
    validStart: validStart.value,
    maxTransactionFee: maxTransactionFee.value as Hbar,
    transactionMemo: transactionMemo.value,
    freezeType: freezeType.value,
    startTimestamp: startTimestamp.value,
    fileId: fileId.value,
    fileHash: fileHash.value,
  });
}

/* Watchers */
watch(fileId, id => {
  if (isAccountId(id) && id !== '0') {
    fileId.value = AccountId.fromString(id).toString();
  }
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';

const startTimeVisibleAtFreezeType = [1, 3];
const fileIdVisibleAtFreezeType = [2, 3];
const fileHashimeVisibleAtFreezeType = [2, 3];
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <!-- :create-requirements to be updated -->
      <TransactionHeaderControls heading-text="Freeze Transaction">
        <template #buttons>
          <div
            v-if="!($route.query.group === 'true')"
            class="flex-centered justify-content-end flex-wrap gap-3 mt-3"
          >
            <SaveDraftButton
              :get-transaction-bytes="() => createTransaction().toBytes()"
              :description="transactionDescription"
              :is-executed="isExecuted || isSubmitted"
            />
            <AppButton color="primary" type="submit" :disabled="!payerData.isValid.value">
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
          <div v-else>
            <AppButton
              v-if="$route.params.seq"
              color="primary"
              type="button"
              @click="handleEditGroupItem"
            >
              <span class="bi bi-plus-lg" />
              Edit Group Item
            </AppButton>
            <AppButton v-else color="primary" type="button" @click="handleAddToGroup">
              <span class="bi bi-plus-lg" />
              Add to Group
            </AppButton>
          </div>
        </template>
      </TransactionHeaderControls>

      <hr class="separator my-5" />

      <div class="fill-remaining">
        <TransactionInfoControls
          v-model:name="transactionName"
          v-model:description="transactionDescription"
        />

        <TransactionIdControls
          v-model:payer-id="payerData.accountId.value"
          v-model:valid-start="validStart"
          v-model:max-transaction-fee="maxTransactionFee as Hbar"
          class="mt-6"
        />

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <label class="form-label">Transaction Memo</label>
            <AppInput
              v-model="transactionMemo"
              :filled="true"
              maxlength="100"
              placeholder="Enter Transaction Memo"
            />
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="row">
          <div :class="[columnClass]">
            <label class="form-label">Freeze Type<span class="text-danger">*</span></label>
            <select class="form-select is-fill" v-model="freezeType">
              <!-- <option value="0">Unknown Freeze Type</option> -->
              <option value="-1">Select Freeze Type</option>
              <option value="1">Freeze Only</option>
              <option value="2">Prepare Upgrade</option>
              <option value="3">Freeze Upgrade</option>
              <option value="4">Freeze Abort</option>
              <!-- <option value="5">Telemetry Upgrade</option> -->
            </select>
          </div>
        </div>

        <div
          v-if="startTimeVisibleAtFreezeType.includes(+freezeType)"
          class="row align-items-end mt-6"
        >
          <div class="form-group" :class="[columnClass]">
            <label class="form-label"
              >Start <span class="text-muted text-italic">- Local time</span
              ><span class="text-danger">*</span></label
            >
            <RunningClockDatePicker
              :model-value="startTimestamp"
              @update:model-value="(v: Date) => (startTimestamp = v)"
              placeholder="Select Start Time"
              :min-date="new Date()"
              :now-button-visible="true"
            />
          </div>
        </div>

        <div
          v-if="fileIdVisibleAtFreezeType.includes(+freezeType)"
          class="row align-items-end mt-6"
        >
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">File ID</label>
            <AppInput
              :model-value="fileId?.toString()"
              @update:model-value="v => (fileId = formatAccountId(v))"
              :filled="true"
              placeholder="Enter File ID"
            />
          </div>
        </div>

        <div
          v-if="fileHashimeVisibleAtFreezeType.includes(+freezeType)"
          class="row align-items-end mt-6"
        >
          <div class="form-group col-8 col-xxxl-6">
            <label class="form-label">File Hash</label>
            <AppInput v-model="fileHash" :filled="true" placeholder="Enter File Hash" />
          </div>
        </div>

        <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
          <div class="form-group col-12 col-xxxl-8">
            <label class="form-label">Observers</label>
            <UsersGroup v-model:userIds="observers" :addable="true" :editable="true" />
          </div>
        </div>

        <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
          <div class="form-group col-12 col-xxxl-8">
            <label class="form-label">Approvers</label>
            <ApproversList v-model:approvers="approvers" :editable="true" />
          </div>
        </div>
      </div>
    </form>

    <TransactionProcessor
      ref="transactionProcessor"
      :on-executed="handleExecuted"
      :on-submitted="handleSubmit"
      :on-local-stored="handleLocalStored"
      :transaction-bytes="transaction?.toBytes() || null"
      :observers="observers"
      :approvers="approvers"
    />
    <AddToGroupModal @addToGroup="handleAddToGroup" />
  </div>
</template>
