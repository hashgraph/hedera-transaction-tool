<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { FileUpdateTransaction, Hbar, Key, KeyList, Timestamp, Transaction } from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import {
  createTransactionId,
  encodeSpecialFileContent,
} from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';

import { getDateTimeLocalInputValue } from '@renderer/utils';
import { getTransactionFromBytes } from '@renderer/utils/transactions';
import { isAccountId } from '@renderer/utils/validator';
import {
  isHederaSpecialFileId,
  getMinimumExpirationTime,
  getMaximumExpirationTime,
} from '@renderer/utils/sdk';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import KeyField from '@renderer/components/KeyField.vue';
import FileTransactionProcessor from '@renderer/components/Transaction/FileTransactionProcessor.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';

/* Composables */
const toast = useToast();
const payerData = useAccountId();
const route = useRoute();

/* State */
const transactionProcessor = ref<typeof FileTransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref<Hbar>(new Hbar(2));

const fileId = ref('');
const memo = ref('');
const expirationTimestamp = ref();
const chunkSize = ref(2048);
const ownerKey = ref<Key | null>(null);
const newOwnerKey = ref<Key | null>(null);
const transactionMemo = ref('');

const fileMeta = ref<File | null>(null);
const fileReader = ref<FileReader | null>(null);
const fileBuffer = ref<Uint8Array | null>(null);
const loadPercentage = ref(0);
const content = ref('');
const chunksAmount = ref<number | null>(null);

const isExecuted = ref(false);

/* Handlers */
const handleRemoveFile = async () => {
  fileReader.value?.abort();
  fileMeta.value = null;
  fileReader.value = null;
  fileBuffer.value = null;
  content.value = '';
};

const handleFileImport = async (e: Event) => {
  const fileImportEl = e.target as HTMLInputElement;
  const file = fileImportEl.files && fileImportEl.files[0];

  if (file) {
    fileMeta.value = file;

    fileReader.value = new FileReader();

    fileReader.value.readAsArrayBuffer(file);
    fileReader.value.addEventListener('loadend', async () => {
      const data = fileReader.value?.result;
      if (data && data instanceof ArrayBuffer) {
        fileBuffer.value = new Uint8Array(data);
      }
    });
    fileReader.value.addEventListener(
      'progress',
      e => (loadPercentage.value = (100 * e.loaded) / e.total),
    );
    fileReader.value.addEventListener('error', () => console.log('Error'));
    fileReader.value.addEventListener('abort', () => console.log('Aborted'));
  }
};

const handleCreate = async e => {
  e.preventDefault();

  try {
    if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
      throw Error('Invalid Payer ID');
    }

    if (!isAccountId(fileId.value)) {
      throw Error('Invalid File ID');
    }

    if (!ownerKey.value) {
      throw Error('Signature key is required');
    }

    const newTransaction = createTransaction();

    if (content.value.length > 0) {
      newTransaction.setContents(content.value);
    }
    if (fileBuffer.value) {
      newTransaction.setContents(fileBuffer.value);
    }

    if (isHederaSpecialFileId(newTransaction.fileId?.toString()) && newTransaction.contents) {
      const getEncodedContent = await encodeSpecialFileContent(
        newTransaction.contents,
        newTransaction.fileId?.toString(),
      );
      newTransaction.setContents(getEncodedContent);
    }

    transaction.value = newTransaction;

    const requiredKey = new KeyList([payerData.key.value, ownerKey.value]);
    newOwnerKey.value && requiredKey.push(newOwnerKey.value);

    await transactionProcessor.value?.process(requiredKey, chunkSize.value, 1);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleLoadFromDraft = async () => {
  if (!route.query.draftId) return;

  const draft = await getDraft(route.query.draftId?.toString() || '');
  const draftTransaction = getTransactionFromBytes<FileUpdateTransaction>(draft.transactionBytes);

  if (draft) {
    transaction.value = draftTransaction;

    if (draftTransaction.keys) {
      newOwnerKey.value = new KeyList(draftTransaction.keys);
    }

    if (draftTransaction.fileId) {
      fileId.value = draftTransaction.fileId.toString();
    }

    memo.value = draftTransaction.fileMemo || '';
    transactionMemo.value = draftTransaction.transactionMemo || '';

    if (draftTransaction.expirationTime) {
      const expirationDate = draftTransaction.expirationTime.toDate();

      expirationTimestamp.value =
        expirationDate > getMinimumExpirationTime() && expirationDate < getMaximumExpirationTime()
          ? getDateTimeLocalInputValue(draftTransaction.expirationTime.toDate())
          : '';
    }
  }
};

/* Functions */
function createTransaction() {
  const transaction = new FileUpdateTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionFee.value)
    .setFileMemo(memo.value);

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  if (isAccountId(fileId.value)) {
    transaction.setFileId(fileId.value);
  }

  if (newOwnerKey.value) {
    transaction.setKeys(
      newOwnerKey.value instanceof KeyList ? newOwnerKey.value : new KeyList([newOwnerKey.value]),
    );
  }

  if (expirationTimestamp.value)
    transaction.setExpirationTime(Timestamp.fromDate(new Date(expirationTimestamp.value)));

  if (transactionMemo.value.length > 0 && transactionMemo.value.length <= MEMO_MAX_LENGTH) {
    transaction.setTransactionMemo(transactionMemo.value);
  }

  return transaction;
}

/* Hooks */
onMounted(async () => {
  if (route.query.fileId) {
    fileId.value = route.query.fileId.toString();
  }

  await handleLoadFromDraft();
});

/* Watchers */
watch(fileMeta, () => (content.value = ''));

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <TransactionHeaderControls heading-text="Update File Transaction">
        <template #buttons>
          <SaveDraftButton
            :get-transaction-bytes="() => createTransaction().toBytes()"
            :is-executed="isExecuted"
          />
          <AppButton
            color="primary"
            type="submit"
            :disabled="!ownerKey || !payerData.isValid.value || !fileId"
          >
            <span class="bi bi-send"></span>
            Sign & Submit</AppButton
          >
        </template>
      </TransactionHeaderControls>

      <hr class="separator my-5" />

      <TransactionIdControls
        v-model:payer-id="payerData.accountId.value"
        v-model:valid-start="validStart"
        v-model:max-transaction-fee="maxTransactionFee as Hbar"
      />

      <hr class="separator my-5" />

      <div class="fill-remaining">
        <div class="row">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">File ID <span class="text-danger">*</span></label>
            <AppInput v-model="fileId" :filled="true" placeholder="Enter File ID" />
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <KeyField
              :model-key="ownerKey"
              @update:model-key="key => (ownerKey = key)"
              is-required
              label="Signature Key"
            />
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <KeyField
              :model-key="newOwnerKey"
              @update:model-key="key => (newOwnerKey = key)"
              label="New Key"
            />
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

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <label class="form-label">Memo</label>
            <AppInput
              v-model="memo"
              type="text"
              :filled="true"
              maxlength="100"
              placeholder="Enter memo"
            />
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-4 col-xxxl-3">
            <label class="form-label">Expiration Time</label>

            <div class="">
              <AppInput
                v-model="expirationTimestamp"
                type="datetime-local"
                step="any"
                :min="getDateTimeLocalInputValue(getMinimumExpirationTime())"
                :max="getDateTimeLocalInputValue(getMaximumExpirationTime())"
                :filled="true"
              />
            </div>
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Chunk Size (If File is large)</label>
            <AppInput
              v-model="chunkSize"
              type="number"
              min="1024"
              max="6144"
              :filled="true"
              placeholder="Enter Chunk Size"
            />
          </div>
        </div>

        <div class="mt-4 form-group">
          <label for="fileUpload" class="form-label">
            <span for="fileUpload" class="btn btn-primary" :class="{ disabled: content.length > 0 }"
              >Upload File</span
            >
          </label>
          <AppInput
            class="form-control form-control-sm is-fill"
            id="fileUpload"
            name="fileUpload"
            type="file"
            :disabled="content.length > 0"
            @change="handleFileImport"
          />
          <template v-if="fileMeta">
            <span v-if="fileMeta" class="ms-3">{{ fileMeta.name }}</span>
            <span v-if="loadPercentage < 100" class="ms-3">{{ loadPercentage.toFixed(2) }}%</span>
            <span v-if="fileMeta" class="ms-3 cursor-pointer" @click="handleRemoveFile"
              ><i class="bi bi-x-lg"></i
            ></span>
          </template>
        </div>

        <div class="row mt-6">
          <div class="form-group col-12 col-xl-8">
            <label class="form-label">File Contents</label>
            <textarea
              v-model="content"
              :disabled="Boolean(fileBuffer)"
              class="form-control is-fill py-3"
              rows="10"
            ></textarea>
          </div>
        </div>
      </div>
    </form>

    <FileTransactionProcessor
      ref="transactionProcessor"
      :transaction-bytes="transaction?.toBytes() || null"
      :on-executed="
        (_response, _receipt, chunkAmount) => {
          isExecuted = true;
          chunksAmount = chunkAmount || null;
        }
      "
      :on-close-success-modal-click="
        () => {
          validStart = '';
          maxTransactionFee = new Hbar(2);
          fileId = '';
          newOwnerKey = null;
          ownerKey = null;
          memo = '';
          expirationTimestamp = undefined;
          fileMeta = null;
          fileBuffer = null;
          chunkSize = 2048;
          content = '';
          chunksAmount = null;
          transaction = null;
        }
      "
    >
      <template #successHeading>File updated successfully</template>
      <template #successContent>
        <p class="text-small d-flex justify-content-between align-items mt-2">
          <span class="text-bold text-secondary">File ID:</span>
          <span>{{ fileId }}</span>
        </p>
        <p v-if="chunksAmount" class="text-small d-flex justify-content-between align-items mt-2">
          <span class="text-bold text-secondary">Number of Chunks</span>
          <span>{{ chunksAmount }}</span>
        </p>
      </template>
    </FileTransactionProcessor>
  </div>
</template>
