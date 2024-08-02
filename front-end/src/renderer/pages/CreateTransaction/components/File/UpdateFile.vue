<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { FileUpdateTransaction, Hbar, Key, KeyList, Timestamp, Transaction } from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import {
  createTransactionId,
  encodeSpecialFileContent,
} from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';

import {
  getPropagationButtonLabel,
  getTransactionFromBytes,
  isAccountId,
  formatAccountId,
} from '@renderer/utils';
import {
  isHederaSpecialFileId,
  getMinimumExpirationTime,
  getMaximumExpirationTime,
} from '@renderer/utils/sdk';

import DatePicker, { DatePickerInstance } from '@vuepic/vue-datepicker';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import KeyField from '@renderer/components/KeyField.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();
const router = useRouter();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);
const datePicker = ref<DatePickerInstance>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(new Date());
const maxTransactionFee = ref<Hbar>(new Hbar(2));

const fileId = ref('');
const memo = ref('');
const expirationTimestamp = ref();
const chunkSize = ref(2048);
const ownerKey = ref<Key | null>(null);
const newOwnerKey = ref<Key | null>(null);
const transactionMemo = ref('');
const removeContent = ref(false);

const fileMeta = ref<File | null>(null);
const fileReader = ref<FileReader | null>(null);
const fileBuffer = ref<Uint8Array | null>(null);
const loadPercentage = ref(0);
const content = ref('');
const isExecuted = ref(false);
const isSubmitted = ref(false);

/* Computed */
const transactionKey = computed(() => {
  const keyList: Key[] = [];

  payerData.key.value && keyList.push(payerData.key.value);
  ownerKey.value && keyList.push(ownerKey.value);
  newOwnerKey.value && keyList.push(newOwnerKey.value);

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

    if (removeContent.value) {
      newTransaction.setContents(new Uint8Array());
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

      if (
        expirationDate > getMinimumExpirationTime() &&
        expirationDate < getMaximumExpirationTime()
      ) {
        expirationTimestamp.value = expirationDate;
      }
    }
  }
};

const handleLocalStored = (id: string) => {
  toast.success('File Update Transaction Executed', { position: 'bottom-right' });
  redirectToDetails(id);
};

const handleSubmit = async (id: number) => {
  isSubmitted.value = true;
  redirectToDetails(id);
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
watch(content, () => {
  if (content.value.length > 0) {
    removeContent.value = false;
  }
});
watch(fileBuffer, buffer => {
  if (buffer && buffer.length > 0) {
    removeContent.value = false;
  }
});
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
            :is-executed="isExecuted || isSubmitted"
          />
          <AppButton
            color="primary"
            type="submit"
            data-testid="button-sign-and-submit-update-file"
            :disabled="!ownerKey || !payerData.isValid.value || !fileId"
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
            data-testid="input-transaction-memo-for-file-update"
            maxlength="100"
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
              @update:model-value="v => (fileId = formatAccountId(v))"
              :filled="true"
              placeholder="Enter File ID"
              data-testid="input-file-id-for-update"
            />
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
            <label class="form-label">Memo</label>
            <AppInput
              v-model="memo"
              type="text"
              :filled="true"
              maxlength="100"
              data-testid="input-file-update-memo"
              placeholder="Enter memo"
            />
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-4 col-xxxl-3">
            <label class="form-label"
              >Expiration <span class="text-muted text-italic">- Local time</span></label
            >
            <DatePicker
              ref="datePicker"
              v-model="expirationTimestamp"
              placeholder="Select Expiration Time"
              :clearable="false"
              :auto-apply="true"
              :config="{
                keepActionRow: true,
              }"
              :teleport="true"
              :min-date="getMinimumExpirationTime()"
              :max-date="getMaximumExpirationTime()"
              class="is-fill"
              menu-class-name="is-fill"
              calendar-class-name="is-fill"
              input-class-name="is-fill"
              calendar-cell-class-name="is-fill"
            >
              <template #action-row>
                <div class="d-flex justify-content-end gap-4 w-100">
                  <AppButton
                    v-if="
                      new Date() >= getMinimumExpirationTime() &&
                      new Date() <= getMaximumExpirationTime()
                    "
                    class="min-w-unset"
                    size="small"
                    type="button"
                    @click="$emit('update:validStart', new Date())"
                  >
                    Now
                  </AppButton>
                  <AppButton
                    class="min-w-unset"
                    color="secondary"
                    size="small"
                    type="button"
                    @click="datePicker?.closeMenu()"
                    >Close</AppButton
                  >
                </div>
              </template>
            </DatePicker>
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
            <span
              for="fileUpload"
              class="btn btn-primary"
              :class="{ disabled: content.length > 0 || removeContent }"
              >Upload File</span
            >
          </label>
          <AppInput
            class="form-control form-control-sm is-fill"
            id="fileUpload"
            name="fileUpload"
            type="file"
            :disabled="content.length > 0 || removeContent"
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
            <Transition name="fade" mode="out-in">
              <AppCheckBox
                v-if="content.length === 0 && !fileBuffer"
                v-model:checked="removeContent"
                label="Remove File Contents"
                name="remove-file-contents"
              />
            </Transition>
            <textarea
              v-model="content"
              data-testid="textarea-update-file-content"
              :disabled="Boolean(fileBuffer) || removeContent"
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
