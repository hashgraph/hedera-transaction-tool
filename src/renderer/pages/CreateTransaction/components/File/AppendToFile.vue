<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { FileAppendTransaction, KeyList, PublicKey, Transaction } from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';

import { getDateTimeLocalInputValue } from '@renderer/utils';
import { getTransactionFromBytes } from '@renderer/utils/transactions';
import { isPublicKey, isAccountId } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import FileTransactionProcessor from '@renderer/components/Transaction/FileTransactionProcessor.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';

/* Composables */
const toast = useToast();
const route = useRoute();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof FileTransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref(2);
const fileId = ref('');
const signatureKeyText = ref('');
const signatureKeys = ref<string[]>([]);

const fileMeta = ref<File | null>(null);
const fileReader = ref<FileReader | null>(null);
const fileBuffer = ref<Uint8Array | null>(null);
const loadPercentage = ref(0);
const content = ref('');

const chunkSize = ref(2048);
const chunksAmount = ref<number | null>(null);

const isExecuted = ref(false);

/* Getters */
const keyList = computed(
  () => new KeyList(signatureKeys.value.map(key => PublicKey.fromString(key))),
);

/* Handlers */
const handleAddSignatureKey = () => {
  signatureKeys.value.push(signatureKeyText.value);
  signatureKeys.value = [...new Set(signatureKeys.value.filter(isPublicKey))];
  signatureKeyText.value = '';
};

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
    fileReader.value.addEventListener('error', () => toast.error('Failed to upload file'));
    fileReader.value.addEventListener('abort', () => toast.error('File upload aborted'));
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

    const newTransaction = createTransaction();

    if (content.value.length > 0) {
      newTransaction.setContents(content.value);
    }
    if (fileBuffer.value) {
      newTransaction.setContents(fileBuffer.value);
    }

    transaction.value = newTransaction;

    const requiredKey = new KeyList([payerData.key.value, keyList.value]);
    await transactionProcessor.value?.process(requiredKey, chunkSize.value, 1);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleLoadFromDraft = async () => {
  if (!route.query.draftId) return;

  const draft = await getDraft(route.query.draftId?.toString() || '');
  const draftTransaction = getTransactionFromBytes<FileAppendTransaction>(draft.transactionBytes);

  if (draft) {
    transaction.value = draftTransaction;

    if (draftTransaction.fileId) {
      fileId.value = draftTransaction.fileId.toString();
    }

    if (draftTransaction.chunkSize) {
      chunkSize.value = draftTransaction.chunkSize;
    }
  }
};

/* Functions */
function createTransaction() {
  const transaction = new FileAppendTransaction()
    .setTransactionValidDuration(180)
    // .setChunkSize(Number(chunkSize.value))
    .setMaxChunks(9999999999999);

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  if (isAccountId(fileId.value)) {
    transaction.setFileId(fileId.value);
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
  <form @submit="handleCreate">
    <TransactionHeaderControls
      :get-transaction-bytes="() => createTransaction().toBytes()"
      :is-executed="isExecuted"
      :create-requirements="keyList._keys.length === 0 || !payerData.isValid.value || !fileId"
      heading-text="Append File Transaction"
    />

    <TransactionIdControls
      v-model:payer-id="payerData.accountId.value"
      v-model:valid-start="validStart"
      v-model:max-transaction-fee="maxTransactionFee"
      class="mt-6"
    />

    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">File ID <span class="text-danger">*</span></label>
        <AppInput v-model="fileId" :filled="true" placeholder="Enter File ID" />
      </div>
    </div>

    <hr class="separator my-6" />

    <div class="row">
      <div class="form-group col-8 col-xxxl-6">
        <label class="form-label">Signature Keys <span class="text-danger">*</span></label>
        <div class="d-flex gap-3">
          <AppInput
            v-model="signatureKeyText"
            :filled="true"
            placeholder="Enter signer public key"
          />
        </div>
      </div>

      <div class="form-group col-4 col-xxxl-6 d-flex align-items-end">
        <AppButton :outline="true" color="primary" type="button" @click="handleAddSignatureKey"
          >Add</AppButton
        >
      </div>
    </div>

    <div class="row">
      <div class="form-group col-8 col-xxxl-6">
        <template v-for="key in signatureKeys" :key="key">
          <div class="d-flex align-items-center gap-3 mt-3">
            <AppInput :model-value="key" :filled="true" readonly />
            <i
              class="bi bi-x-lg d-inline-block cursor-pointer"
              @click="signatureKeys = signatureKeys.filter(k => k !== key)"
            ></i>
          </div>
        </template>
      </div>
    </div>

    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Chunk Size</label>
        <AppInput v-model="chunkSize" :filled="true" type="number" min="1024" max="6144" />
      </div>
    </div>

    <div class="form-group mt-4">
      <label for="fileUpload" class="form-label">
        <span for="fileUpload" class="btn btn-primary" :class="{ disabled: content.length > 0 }"
          >Upload File</span
        >
      </label>
      <AppInput
        :filled="true"
        size="small"
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
        maxTransactionFee = 2;
        fileId = '';
        signatureKeys = [];
        fileMeta = null;
        fileBuffer = null;
        chunkSize = 2048;
        content = '';
        chunksAmount = null;
        transaction = null;
      }
    "
  >
    <template #successHeading>Appended to file successfully</template>
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
</template>
