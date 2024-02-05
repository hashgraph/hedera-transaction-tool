<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { AccountId, FileUpdateTransaction, KeyList, PublicKey, Timestamp } from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';
import { useRoute } from 'vue-router';

import { createTransactionId } from '../../../../services/transactionService';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppInput from '../../../../components/ui/AppInput.vue';
import TransactionProcessor from '../../../../components/Transaction/TransactionProcessor.vue';
import TransactionIdControls from '../../../../components/Transaction/TransactionIdControls.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';

import { getDateTimeLocalInputValue } from '@renderer/utils';

/* Stores */
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();
const route = useRoute();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<FileUpdateTransaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref(2);

const fileId = ref('');
const ownerKeyText = ref('');
const newKeyText = ref('');
const memo = ref('');
const expirationTimestamp = ref();
const chunkSize = ref(2048);
const ownerKeys = ref<string[]>([]);
const newKeys = ref<string[]>([]);

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
const newKeysList = computed(
  () => new KeyList(newKeys.value.map(key => PublicKey.fromString(key))),
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

  newKeysList.value._keys.length > 0 && updateTransaction.setKeys(newKeysList.value);

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

const handleAddNewKey = () => {
  newKeys.value.push(newKeyText.value);
  newKeys.value = newKeys.value.filter(isPublicKey);
  newKeyText.value = '';
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
      payerData.keysFlattened.value.concat(newKeys.value, ownerKeys.value),
      chunkSize.value,
      1,
    );
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

/* Hooks */
onMounted(async () => {
  if (route.query.fileId) {
    fileId.value = route.query.fileId.toString();
  }
});

/* Watchers */
watch(fileMeta, () => (content.value = ''));
</script>
<template>
  <form @submit="handleCreate">
    <TransactionHeaderControls
      :create-requirements="ownerKeyList._keys.length === 0 || !payerData.isValid.value"
      heading-text="Update File Transaction"
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
        <AppInput v-model="ownerKeyText" :filled="true" placeholder="Enter signer public key" />
        <AppButton color="secondary" type="button" class="rounded-4" @click="handleAddOwnerKey"
          >Add</AppButton
        >
      </div>
    </div>
    <div class="mt-4 w-75">
      <template v-for="key in ownerKeys" :key="key">
        <div class="d-flex align-items-center gap-3">
          <AppInput :model-value="key" :filled="true" readonly />
          <i
            class="bi bi-x-lg d-inline-block cursor-pointer"
            style="line-height: 16px"
            @click="ownerKeys = ownerKeys.filter(k => k !== key)"
          ></i>
        </div>
      </template>
    </div>
    <div class="form-group w-75">
      <label class="form-label">Keys</label>
      <div class="d-flex gap-3">
        <AppInput v-model="newKeyText" :filled="true" placeholder="Enter owner public key" />
        <AppButton color="secondary" type="button" class="rounded-4" @click="handleAddNewKey"
          >Add</AppButton
        >
      </div>
    </div>
    <div class="mt-4 w-75">
      <template v-for="key in newKeys" :key="key">
        <div class="d-flex align-items-center gap-3">
          <AppInput type="text" readonly :filled="true" :value="key" />
          <i
            class="bi bi-x-lg d-inline-block cursor-pointer"
            style="line-height: 16px"
            @click="newKeys = newKeys.filter(k => k !== key)"
          ></i>
        </div>
      </template>
    </div>
    <div class="mt-4 form-group w-50">
      <label class="form-label">File Memo (Optional)</label>
      <AppInput
        v-model="memo"
        type="text"
        :filled="true"
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
        placeholder="Enter timestamp"
      />
    </div>
    <div class="mt-4 form-group w-25">
      <label class="form-label">Set Chunk Size (If File is large)</label>
      <AppInput v-model="chunkSize" type="number" min="1024" max="6144" :filled="true" />
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
        validStart = '';
        maxTransactionFee = 2;
        fileId = '';
        newKeys = [];
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
