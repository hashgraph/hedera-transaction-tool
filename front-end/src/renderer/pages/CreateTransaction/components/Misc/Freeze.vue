<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { AccountId, Hbar, FreezeTransaction, FileId, Timestamp } from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';
import { uint8ArrayToHex } from '@renderer/services/electronUtilsService';

import { isAccountId, isFileId } from '@renderer/utils/validator';
import { getTransactionFromBytes } from '@renderer/utils/transactions';

import DatePicker from '@vuepic/vue-datepicker';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';

/* Composables */
const toast = useToast();
const route = useRoute();

const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<FreezeTransaction | null>(null);
const validStart = ref(new Date());
const maxTransactionfee = ref<Hbar>(new Hbar(2));

const freezeType = ref(-1);
const startTimestamp = ref(new Date());
const fileId = ref<string>('');
const fileHash = ref('');

const transactionMemo = ref('');
const isExecuted = ref(false);

/* Handlers */
const handleCreate = async e => {
  e.preventDefault();

  try {
    if (!isAccountId(payerData.accountId.value)) {
      throw new Error('Invalid Payer ID');
    }

    transaction.value = createTransaction();

    await transactionProcessor.value?.process(payerData.key.value);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleLoadFromDraft = async () => {
  if (!route.query.draftId) return;

  const draft = await getDraft(route.query.draftId.toString());
  const draftTransaction = getTransactionFromBytes<FreezeTransaction>(draft.transactionBytes);

  if (draft) {
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

/* Hooks */
onMounted(async () => {
  await handleLoadFromDraft();
});

/* Functions */
function createTransaction() {
  const transaction = new FreezeTransaction()
    .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionfee.value)
    .setNodeAccountIds([new AccountId(3)]);
  // .setFreezeType(FreezeType._fromCode(Number(freezeType.value)))

  // Set fields based on freeze type later

  transaction.setStartTimestamp(Timestamp.fromDate(startTimestamp.value));
  isFileId(fileId.value) && transaction.setFileId(FileId.fromString(fileId.value));
  fileHash.value.trim().length > 0 && transaction.setFileHash(fileHash.value);

  if (transactionMemo.value.length > 0 && transactionMemo.value.length <= MEMO_MAX_LENGTH) {
    transaction.setTransactionMemo(transactionMemo.value);
  }

  return transaction;
}

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
          <SaveDraftButton
            :get-transaction-bytes="() => createTransaction().toBytes()"
            :is-executed="isExecuted"
          />
          <AppButton color="primary" type="submit" :disabled="true">
            <span class="bi bi-send"></span>
            Sign & Submit</AppButton
          >
        </template>
      </TransactionHeaderControls>

      <hr class="separator my-5" />

      <TransactionIdControls
        v-model:payer-id="payerData.accountId.value"
        v-model:valid-start="validStart"
        v-model:max-transaction-fee="maxTransactionfee as Hbar"
      />

      <hr class="separator my-5" />

      <div class="fill-remaining">
        <div class="row">
          <div :class="[columnClass]">
            <label class="form-label">Freeze Type<span class="text-danger">*</span></label>
            <select class="form-select" v-model="freezeType">
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
            <label class="form-label">Start Time<span class="text-danger">*</span></label>
            <DatePicker
              :model-value="startTimestamp"
              @update:model-value="v => (startTimestamp = v)"
              placeholder="Select Start Time"
              :clearable="false"
              :auto-apply="true"
              :config="{
                keepActionRow: true,
              }"
              :teleport="true"
              :min-date="new Date()"
              class="is-fill"
              menu-class-name="is-fill"
              calendar-class-name="is-fill"
              input-class-name="is-fill"
              calendar-cell-class-name="is-fill"
            >
              <template #action-row>
                <div class="d-grid w-100">
                  <AppButton
                    color="secondary"
                    size="small"
                    type="button"
                    @click="$emit('update:validStart', new Date())"
                  >
                    Now
                  </AppButton>
                </div>
              </template>
            </DatePicker>
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
              @update:model-value="
                v => (fileId = isFileId(v) && v !== '0' ? FileId.fromString(v).toString() : v)
              "
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
      </div>
    </form>

    <TransactionProcessor
      ref="transactionProcessor"
      :on-executed="handleExecuted"
      :transaction-bytes="transaction?.toBytes() || null"
    >
      <template #successHeading>Freeze executed successfully</template>
      <template #successContent>
        <p
          v-if="transactionProcessor?.transactionResult"
          class="text-small d-flex justify-content-between align-items mt-2"
        >
          <span class="text-bold text-secondary">File ID:</span>
          <span>{{ fileId?.toString() }}</span>
        </p>
      </template>
    </TransactionProcessor>
  </div>
</template>
