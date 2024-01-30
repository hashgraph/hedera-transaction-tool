<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { AccountId, FileUpdateTransaction, KeyList, PublicKey, Timestamp } from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { createTransactionId } from '../../../../services/transactionService';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppInput from '../../../../components/ui/AppInput.vue';
import TransactionProcessor from '../../../../components/TransactionProcessor.vue';

/* Stores */
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<FileUpdateTransaction | null>(null);
const validStart = ref('');
const maxTransactionFee = ref(2);

const fileId = ref('');
const signatureKeyText = ref('');
const ownerKeyText = ref('');
const memo = ref('');
const expirationTimestamp = ref();
const chunkSize = ref(2048);
const signatureKeys = ref<string[]>([]);
const ownerKeys = ref<string[]>([]);

const fileMeta = ref<File | null>(null);
const fileReader = ref<FileReader | null>(null);
const fileBuffer = ref<Uint8Array | null>(null);
const loadPercentage = ref(0);
const content = ref('');
const chunksAmount = ref<number | null>(null);

/* Getters */
const ownerKeyList = computed(
  () => new KeyList(ownerKeys.value.map(key => PublicKey.fromString(key))),
);

/* Misc Functions */
const createTransaction = () => {
  const updateTransaction = new FileUpdateTransaction()
    .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionFee.value)
    .setNodeAccountIds([new AccountId(3)])
    .setFileId(fileId.value)
    .setFileMemo(memo.value);

  ownerKeyList.value._keys.length > 0 && updateTransaction.setKeys(ownerKeyList.value);

  expirationTimestamp.value &&
    updateTransaction.setExpirationTime(Timestamp.fromDate(expirationTimestamp.value));

  if (content.value.length > 0) {
    updateTransaction.setContents(content.value);
  }
  if (fileBuffer.value) {
    updateTransaction.setContents(fileBuffer.value);
  }

  updateTransaction.freezeWith(networkStore.client);

  return updateTransaction;
};

/* Handlers */
const isPublicKey = key => {
  try {
    return PublicKey.fromString(key);
  } catch (error) {
    return false;
  }
};

const handleAddOwnerKey = () => {
  ownerKeys.value.push(ownerKeyText.value);
  ownerKeys.value = ownerKeys.value.filter(isPublicKey);
  ownerKeyText.value = '';
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
    fileReader.value.addEventListener('error', () => console.log('Error'));
    fileReader.value.addEventListener('abort', () => console.log('Aborted'));
  }
};

const handleCreate = async e => {
  e.preventDefault();

  try {
    transaction.value = createTransaction();
    await transactionProcessor.value?.process(
      payerData.keysFlattened.value.concat(signatureKeys.value, ownerKeys.value),
      chunkSize.value,
      1,
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
    <div class="d-flex justify-content-between align-items-center">
      <h2 class="text-title text-bold">Update File Transaction</h2>

      <div class="d-flex justify-content-end align-items-center">
        <AppButton
          size="large"
          type="submit"
          color="primary"
          :disabled="
            !fileId ||
            !payerData.isValid.value ||
            signatureKeys.length === 0 ||
            (content.length > 0 && fileBuffer)
          "
          >Sign & Submit</AppButton
        >
      </div>
    </div>

    <div class="mt-4 d-flex flex-wrap gap-5">
      <div class="form-group col-4">
        <label class="form-label">Set Payer ID (Required)</label>
        <label v-if="payerData.isValid.value" class="d-block form-label text-secondary"
          >Balance: {{ payerData.accountInfo.value?.balance || 0 }}</label
        >
        <AppInput
          :model-value="payerData.accountIdFormatted.value"
          @update:model-value="v => (payerData.accountId.value = v)"
          :filled="true"
          placeholder="Enter Payer ID"
        />
      </div>
      <div class="form-group">
        <label class="form-label">Set Valid Start Time (Required)</label>
        <AppInput v-model="validStart" type="datetime-local" step="1" :filled="true" />
      </div>
      <div class="form-group">
        <label class="form-label">Set Max Transaction Fee (Optional)</label>
        <AppInput v-model="maxTransactionFee" type="number" min="0" :filled="true" />
      </div>
    </div>
    <div class="mt-4 form-group w-50">
      <label class="form-label">Set File ID</label>
      <AppInput v-model="fileId" :filled="true" class="py-3" placeholder="Enter File ID" />
    </div>
    <div class="mt-4 form-group w-75">
      <label class="form-label">Set Signature Keys (Required)</label>
      <div class="d-flex gap-3">
        <AppInput
          v-model="signatureKeyText"
          :filled="true"
          class="py-3"
          placeholder="Enter signer public key"
          style="max-width: 555px"
          @keypress="e => e.code === 'Enter' && handleAddSignatureKey()"
        />
        <AppButton color="secondary" type="button" class="rounded-4" @click="handleAddSignatureKey"
          >Add</AppButton
        >
      </div>
    </div>
    <div class="mt-4 w-75">
      <template v-for="key in signatureKeys" :key="key">
        <div class="d-flex align-items-center gap-3">
          <AppInput
            :model-value="key"
            :filled="true"
            class="py-3"
            readonly
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
    <div class="form-group w-75">
      <label class="form-label">Set Keys (Optional)</label>
      <div class="d-flex gap-3">
        <AppInput
          v-model="ownerKeyText"
          :filled="true"
          class="py-3"
          placeholder="Enter owner public key"
          style="max-width: 555px"
          @keypress="e => e.code === 'Enter' && handleAddOwnerKey()"
        />
        <AppButton color="secondary" type="button" class="rounded-4" @click="handleAddOwnerKey"
          >Add</AppButton
        >
      </div>
    </div>
    <div class="mt-4 w-75">
      <template v-for="key in ownerKeys" :key="key">
        <div class="d-flex align-items-center gap-3">
          <AppInput
            type="text"
            readonly
            :filled="true"
            class="py-3"
            :value="key"
            style="max-width: 555px"
          />
          <i
            class="bi bi-x-lg d-inline-block cursor-pointer"
            style="line-height: 16px"
            @click="ownerKeys = ownerKeys.filter(k => k !== key)"
          ></i>
        </div>
      </template>
    </div>
    <div class="mt-4 form-group w-50">
      <label class="form-label">Set File Memo (Optional)</label>
      <AppInput
        v-model="memo"
        type="text"
        :filled="true"
        class="py-3"
        maxlength="100"
        placeholder="Enter memo"
      />
    </div>
    <div class="mt-4 form-group w-25">
      <label class="form-label">Set Expiration Time (Optional)</label>
      <AppInput
        v-model="expirationTimestamp"
        type="datetime-local"
        :filled="true"
        class="py-3"
        placeholder="Enter timestamp"
      />
    </div>
    <div class="mt-4 form-group w-25">
      <label class="form-label">Set Chunk Size (If File is large)</label>
      <AppInput
        v-model="chunkSize"
        type="number"
        min="1024"
        max="6144"
        :filled="true"
        class="py-3"
      />
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
    <div class="mt-4 form-group w-75">
      <label class="form-label">Set File Contents</label>
      <textarea
        v-model="content"
        :disabled="Boolean(fileBuffer)"
        class="form-control py-3"
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
        ownerKeys = [];
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
  </TransactionProcessor>
</template>
