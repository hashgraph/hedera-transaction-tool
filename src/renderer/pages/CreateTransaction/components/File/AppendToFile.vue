<script setup lang="ts">
import { ref, watch } from 'vue';
import { AccountId, FileAppendTransaction, PublicKey } from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { createTransactionId } from '../../../../services/transactionService';

import TransactionProcessor from '../../../../components/TransactionProcessor.vue';
import AppButton from '../../../../components/ui/AppButton.vue';

/* Stores */
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<FileAppendTransaction | null>(null);
const validStart = ref('');
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

/* Handlers */
const createTransaction = () => {
  const appendTransaction = new FileAppendTransaction()
    .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
    .setTransactionValidDuration(180)
    .setNodeAccountIds([new AccountId(3)])
    .setFileId(fileId.value)
    .setMaxChunks(99999999999999)
    .setChunkSize(chunkSize.value)
    .setContents(fileBuffer.value ? fileBuffer.value : new TextEncoder().encode(content.value));

  appendTransaction.freezeWith(networkStore.client);

  return appendTransaction;
};

const handleAddSignatureKey = () => {
  signatureKeys.value.push(signatureKeyText.value);
  signatureKeys.value = signatureKeys.value.filter(key => {
    try {
      return PublicKey.fromString(key);
    } catch (error) {
      return false;
    }
  });
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
    transaction.value = createTransaction();
    await transactionProcessor.value?.process(
      payerData.keysFlattened.value.concat(signatureKeys.value),
      chunkSize.value,
      0,
    );
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

/* Watchers */
watch(fileMeta, () => (content.value = ''));
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-small text-bold">Append To File Transaction</span>
      </div>
    </div>
    <form class="mt-4" @submit="handleCreate">
      <div class="mt-4 d-flex flex-wrap gap-5">
        <div class="form-group col-4">
          <label class="form-label">Set Payer ID (Required)</label>
          <label v-if="payerData.isValid.value" class="d-block form-label text-secondary"
            >Balance: {{ payerData.accountInfo.value?.balance || 0 }}</label
          >
          <input
            :value="payerData.accountIdFormatted.value"
            @input="payerData.accountId.value = ($event.target as HTMLInputElement).value"
            type="text"
            class="form-control is-fill"
            placeholder="Enter Payer ID"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Set Valid Start Time (Required)</label>
          <input v-model="validStart" type="datetime-local" step="1" class="form-control is-fill" />
        </div>
        <div class="form-group">
          <label class="form-label">Set Max Transaction Fee (Optional)</label>
          <input v-model="maxTransactionFee" type="number" min="0" class="form-control is-fill" />
        </div>
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set File ID</label>
        <input
          v-model="fileId"
          type="text"
          class="form-control is-fill py-3"
          placeholder="Enter File ID"
        />
      </div>
      <div class="mt-4 form-group w-75">
        <label class="form-label">Set Signature Keys (Required)</label>
        <div class="d-flex gap-3">
          <input
            v-model="signatureKeyText"
            type="text"
            class="form-control is-fill py-3"
            placeholder="Enter signer public key"
            style="max-width: 555px"
            @keypress="e => e.code === 'Enter' && handleAddSignatureKey()"
          />
          <AppButton
            color="secondary"
            type="button"
            class="rounded-4"
            @click="handleAddSignatureKey"
            >Add</AppButton
          >
        </div>
      </div>
      <div class="mt-4 w-75">
        <template v-for="key in signatureKeys" :key="key">
          <div class="d-flex align-items-center gap-3">
            <input
              type="text"
              readonly
              class="form-control is-fill py-3"
              :value="key"
              style="max-width: 555px"
            />
            <i
              class="bi bi-x-lg d-inline-block cursor-pointer"
              style="line-height: 16px"
              @click="signatureKeys = signatureKeys.filter(k => k !== key)"
            ></i>
          </div>
        </template>
      </div>
      <div class="mt-4 form-group w-25">
        <label class="form-label">Set Chunk Size</label>
        <input
          v-model="chunkSize"
          type="number"
          min="1024"
          max="6144"
          class="form-control is-fill py-3"
        />
      </div>
      <div class="mt-4 form-group">
        <label for="fileUpload" class="form-label">
          <span for="fileUpload" class="btn btn-primary" :class="{ disabled: content.length > 0 }"
            >Upload File</span
          >
        </label>
        <input
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
      <div class="mt-4 form-group w-75">
        <label class="form-label">Set File Contents</label>
        <textarea
          v-model="content"
          :disabled="Boolean(fileBuffer)"
          class="form-control is-fill py-3"
          rows="10"
        ></textarea>
      </div>

      <div class="mt-4">
        <!-- <AppButton size="small" color="secondary" class="me-3 px-4 rounded-4">Save Draft</AppButton> -->
        <AppButton
          size="large"
          type="submit"
          color="primary"
          :disabled="
            !fileId ||
            !payerData.isValid.value ||
            signatureKeys.length === 0 ||
            (!content && !fileBuffer)
          "
          >Create</AppButton
        >
      </div>
    </form>
    <TransactionProcessor
      ref="transactionProcessor"
      :transaction-bytes="transaction?.toBytes() || null"
      :on-executed="(_result, _chunkAmount) => (chunksAmount = _chunkAmount || null)"
      :on-close-success-modal-click="
        () => {
          payerData.accountId.value = '';
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
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">File ID:</span>
          <span>{{ fileId }}</span>
        </p>
        <p v-if="chunksAmount" class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Number of Chunks</span>
          <span>{{ chunksAmount }}</span>
        </p>
      </template>
    </TransactionProcessor>
  </div>
</template>
