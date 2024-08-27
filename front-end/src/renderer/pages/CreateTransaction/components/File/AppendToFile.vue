<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { FileAppendTransaction, Hbar, Key, KeyList, Transaction } from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';
import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import useUserStore from '@renderer/stores/storeUser';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useToast } from 'vue-toast-notification';
import { useRoute, useRouter } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';

import {
  getTransactionFromBytes,
  getPropagationButtonLabel,
  isAccountId,
  formatAccountId,
  isHederaSpecialFileId,
} from '@renderer/utils';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import KeyField from '@renderer/components/KeyField.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionInfoControls from '@renderer/components/Transaction/TransactionInfoControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor';

/* Stores */
const user = useUserStore();
const transactionGroup = useTransactionGroupStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const route = useRoute();
const payerData = useAccountId();

/* Constants */
const DISPLAY_FILE_SIZE_LIMIT = 512 * 1024;

/* State */
const transactionProcessor = ref<InstanceType<typeof TransactionProcessor> | null>(null);

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
const uploadedFileText = ref<string | null>(null);

const chunkSize = ref(4096);

const isExecuted = ref(false);
const isSubmitted = ref(false);

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const transactionMemo = ref('');
const transactionName = ref('');
const transactionDescription = ref('');

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
  uploadedFileText.value = null;
};

const handleFileImport = async (e: Event) => {
  const fileImportEl = e.target as HTMLInputElement;
  const file = fileImportEl.files && fileImportEl.files[0];

  if (file) {
    fileMeta.value = file;
    uploadedFileText.value = null;

    fileReader.value = new FileReader();

    fileReader.value.readAsArrayBuffer(file);
    fileReader.value.addEventListener('loadend', async () => {
      const data = fileReader.value?.result;
      if (data && data instanceof ArrayBuffer) {
        fileBuffer.value = new Uint8Array(data);
        await syncDisplayedContent();
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

    if (chunkSize.value) {
      newTransaction.setChunkSize(chunkSize.value);
    }

    transaction.value = newTransaction;
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
    const draftTransaction = getTransactionFromBytes<FileAppendTransaction>(draftTransactionBytes);
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

  if (isAccountId(payerData.accountId.value) && !route.params.seq) {
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

async function syncDisplayedContent() {
  if (fileBuffer.value === null) {
    uploadedFileText.value = null;
    return;
  }

  if (fileMeta.value && fileMeta.value?.size > DISPLAY_FILE_SIZE_LIMIT) {
    uploadedFileText.value = '';
    return;
  }

  if (isHederaSpecialFileId(fileId.value)) {
    uploadedFileText.value =
      (await window.electronAPI.local.files.decodeProto(fileId.value, fileBuffer.value)) || '';
  } else {
    uploadedFileText.value = new TextDecoder().decode(fileBuffer.value);
  }
}

function handleAddToGroup() {
  if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
    throw Error('Invalid Payer ID');
  }

  if (!isAccountId(fileId.value)) {
    throw Error('Invalid File ID');
  }

  if (!ownerKey.value) {
    throw Error('Signature key is required');
  }

  observers.value = [];
  approvers.value = [];
  const transactionBytes = createTransaction().toBytes();
  const keys = new Array<string>();
  if (ownerKey.value instanceof KeyList) {
    for (const key of ownerKey.value.toArray()) {
      keys.push(key.toString());
    }
  }
  // TODO: handle single key?
  transactionGroup.addGroupItem({
    transactionBytes: transactionBytes,
    type: 'FileAppendTransaction',
    accountId: '',
    seq: transactionGroup.groupItems.length.toString(),
    groupId: transactionGroup.groupItems[Number(route.query.groupIndex)].groupId,
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
  if (ownerKey.value instanceof KeyList) {
    for (const key of ownerKey.value.toArray()) {
      keys.push(key.toString());
    }
  }

  transactionGroup.editGroupItem({
    transactionBytes: transactionBytes,
    type: 'AccountAllowanceApproveTransaction',
    accountId: '',
    seq: route.params.seq[0],
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
  if (router.currentRoute.value.query.fileId) {
    fileId.value = router.currentRoute.value.query.fileId.toString();
  }

  await handleLoadFromDraft();
});

/* Watchers */
watch(fileMeta, () => (content.value = ''));
watch(fileId, async () => {
  await syncDisplayedContent();
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <TransactionHeaderControls heading-text="Append File Transaction">
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
              data-testid="input-transaction-memo-for-file-append"
              placeholder="Enter Transaction Memo"
            />
          </div>
        </div>

        <hr class="separator my-5" />

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
            <label class="form-label"
              >File Contents
              <span v-if="fileMeta && fileMeta?.size > DISPLAY_FILE_SIZE_LIMIT">
                - the content is too big to be displayed</span
              ></label
            >
            <textarea
              v-if="Boolean(fileBuffer)"
              :value="uploadedFileText"
              data-testid="textarea-update-file-read-content"
              :disabled="true"
              class="form-control is-fill py-3"
              rows="10"
            ></textarea>
            <textarea
              v-else
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
