<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { FileAppendTransaction, Hbar, Key, KeyList, Transaction } from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';

import {
  getTransactionFromBytes,
  getPropagationButtonLabel,
  isAccountId,
  formatAccountId,
} from '@renderer/utils';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import KeyField from '@renderer/components/KeyField.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(new Date());
const maxTransactionFee = ref<Hbar>(new Hbar(2));
const fileId = ref('');
const ownerKey = ref<Key | null>(null);

const fileMeta = ref<File | null>(null);
const fileReader = ref<FileReader | null>(null);
const fileBuffer = ref<Uint8Array | null>(null);
const loadPercentage = ref(0);
const content = ref('');

const transactionMemo = ref('');
const chunkSize = ref(2048);

const isExecuted = ref(false);
const isSubmitted = ref(false);

/* Computed */
const transactionKey = computed(() => {
  const keyList: Key[] = [];

  payerData.key.value && keyList.push(payerData.key.value);
  ownerKey.value && keyList.push(ownerKey.value);

  return new KeyList(keyList);
});

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

    transaction.value = newTransaction;
    await transactionProcessor.value?.process(transactionKey.value, chunkSize.value, 1);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleLoadFromDraft = async () => {
  if (!router.currentRoute.value.query.draftId) return;

  const draft = await getDraft(router.currentRoute.value.query.draftId?.toString() || '');
  const draftTransaction = getTransactionFromBytes<FileAppendTransaction>(draft.transactionBytes);

  if (draft) {
    transaction.value = draftTransaction;
    transactionMemo.value = draftTransaction.transactionMemo || '';

    if (draftTransaction.fileId) {
      fileId.value = draftTransaction.fileId.toString();
    }

    if (draftTransaction.chunkSize) {
      chunkSize.value = draftTransaction.chunkSize;
    }
  }
};

const handleLocalStored = (id: string) => {
  toast.success('Append to File Transaction Executed', { position: 'bottom-right' });
  redirectToDetails(id);
};

const handleSubmit = async (id: number) => {
  isSubmitted.value = true;
  redirectToDetails(id);
};

/* Functions */
function createTransaction() {
  const transaction = new FileAppendTransaction()
    .setTransactionValidDuration(180)
    .setChunkSize(Number(chunkSize.value))
    .setMaxChunks(9999999999999);

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  if (isAccountId(fileId.value)) {
    transaction.setFileId(fileId.value);
  }

  if (transactionMemo.value.length > 0 && transactionMemo.value.length <= MEMO_MAX_LENGTH) {
    transaction.setTransactionMemo(transactionMemo.value);
  }

  return transaction;
}

async function redirectToDetails(id: string | number) {
  router.push({
    name: 'transactionDetails',
    params: { id },
  });
}

/* Hooks */
onMounted(async () => {
  if (router.currentRoute.value.query.fileId) {
    fileId.value = router.currentRoute.value.query.fileId.toString();
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
      <TransactionHeaderControls heading-text="Append File Transaction">
        <template #buttons>
          <SaveDraftButton
            :get-transaction-bytes="() => createTransaction().toBytes()"
            :is-executed="isExecuted || isSubmitted"
          />
          <AppButton
            color="primary"
            type="submit"
            data-testid="button-sign-and-submit-file-append"
            :disabled="
              (!isLoggedInOrganization(user.selectedOrganization) && !ownerKey) ||
              !payerData.isValid.value ||
              !fileId
            "
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
        </template>
      </TransactionHeaderControls>

      <hr class="separator my-5" />

      <TransactionIdControls
        v-model:payer-id="payerData.accountId.value"
        v-model:valid-start="validStart"
        v-model:max-transaction-fee="maxTransactionFee as Hbar"
      />

      <div class="row mt-6">
        <div class="form-group col-8 col-xxxl-6">
          <label class="form-label">Transaction Memo</label>
          <AppInput
            v-model="transactionMemo"
            :filled="true"
            maxlength="100"
            data-testid="input-transaction-memo-for-file-append"
            placeholder="Enter Transaction Memo"
          />
        </div>
      </div>

      <hr class="separator my-5" />

      <div class="fill-remaining">
        <div class="row">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">File ID <span class="text-danger">*</span></label>
            <AppInput
              :model-value="fileId"
              @update:model-value="fileId = formatAccountId($event)"
              data-testid="input-file-id-append"
              :filled="true"
              placeholder="Enter File ID"
            />
          </div>
        </div>

        <div v-if="!isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
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
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Chunk Size</label>
            <AppInput
              v-model="chunkSize"
              :filled="true"
              type="number"
              min="1024"
              max="6144"
              placeholder="Enter Chunk Size"
            />
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
              data-testid="textarea-file-content-for-append"
              :disabled="Boolean(fileBuffer)"
              class="form-control is-fill py-3"
              rows="10"
            ></textarea>
          </div>
        </div>
      </div>
    </form>

    <TransactionProcessor
      ref="transactionProcessor"
      :transaction-bytes="transaction?.toBytes() || null"
      :on-executed="
        () => {
          isExecuted = true;
        }
      "
      :on-local-stored="handleLocalStored"
      :on-submitted="handleSubmit"
    />
  </div>
</template>
