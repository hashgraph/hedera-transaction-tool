<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { AccountId, FileAppendTransaction, KeyList, PublicKey } from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { createTransactionId } from '../../../../services/transactionService';
import { getDateTimeLocalInputValue } from '../../../../utils';
import { isPublicKey } from '../../../../utils/validator';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppInput from '../../../../components/ui/AppInput.vue';
import TransactionProcessor from '../../../../components/Transaction/TransactionProcessor.vue';
import TransactionIdControls from '../../../../components/Transaction/TransactionIdControls.vue';
import TransactionHeaderControls from '../../../../components/Transaction/TransactionHeaderControls.vue';

/* Stores */
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<FileAppendTransaction | null>(null);
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

/* Getters */
const keyList = computed(
  () => new KeyList(signatureKeys.value.map(key => PublicKey.fromString(key))),
);

/* Handlers */
const createTransaction = () => {
  const appendTransaction = new FileAppendTransaction()
    .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
    .setTransactionValidDuration(180)
    .setNodeAccountIds([new AccountId(3)])
    .setFileId(fileId.value)
    .setMaxChunks(99999999999999)
    .setChunkSize(Number(chunkSize.value))
    .setContents(fileBuffer.value ? fileBuffer.value : new TextEncoder().encode(content.value));

  appendTransaction.freezeWith(networkStore.client);

  return appendTransaction;
};

const handleAddSignatureKey = () => {
  signatureKeys.value.push(signatureKeyText.value);
  signatureKeys.value = signatureKeys.value.filter(isPublicKey);
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
  <form @submit="handleCreate">
    <TransactionHeaderControls
      :create-requirements="keyList._keys.length === 0 || !payerData.isValid.value"
      heading-text="Append File Transaction"
    />

    <TransactionIdControls
      v-model:payer-id="payerData.accountId.value"
      v-model:valid-start="validStart"
      v-model:max-transaction-fee="maxTransactionFee"
      class="mt-6"
    />

    <hr class="separator my-6" />

    <div class="mt-4 form-group w-50">
      <label class="form-label">File ID <span class="text-danger">*</span></label>
      <AppInput v-model="fileId" :filled="true" placeholder="Enter File ID" />
    </div>
    <div class="mt-4 form-group w-75">
      <label class="form-label">Signature Keys <span class="text-danger">*</span></label>
      <div class="d-flex gap-3">
        <AppInput
          v-model="signatureKeyText"
          :filled="true"
          placeholder="Enter signer public key"
          @keypress="e => e.code === 'Enter' && handleAddSignatureKey()"
        />
        <AppButton color="secondary" type="button" class="rounded-4" @click="handleAddSignatureKey"
          >Add</AppButton
        >
      </div>
    </div>
    <div class="mt-4 w-75">
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
    <div class="mt-4 form-group w-25">
      <label class="form-label">Chunk Size</label>
      <AppInput v-model="chunkSize" :filled="true" type="number" min="1024" max="6144" />
    </div>
    <div class="mt-4 form-group">
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
    <div class="mt-4 form-group w-75">
      <label class="form-label">File Contents</label>
      <textarea
        v-model="content"
        :disabled="Boolean(fileBuffer)"
        class="form-control is-fill py-3"
        rows="10"
      ></textarea>
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
      <p class="text-small d-flex justify-content-between align-items mt-2">
        <span class="text-bold text-secondary">File ID:</span>
        <span>{{ fileId }}</span>
      </p>
      <p v-if="chunksAmount" class="text-small d-flex justify-content-between align-items mt-2">
        <span class="text-bold text-secondary">Number of Chunks</span>
        <span>{{ chunksAmount }}</span>
      </p>
    </template>
  </TransactionProcessor>
</template>
