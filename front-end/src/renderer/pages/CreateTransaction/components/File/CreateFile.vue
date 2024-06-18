<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  FileCreateTransaction,
  Hbar,
  Key,
  KeyList,
  Timestamp,
  Transaction,
  TransactionReceipt,
} from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH, TRANSACTION_MAX_SIZE } from '@main/shared/constants';
import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';
import { add } from '@renderer/services/filesService';

import {
  createFileInfo,
  getMinimumExpirationTime,
  getMaximumExpirationTime,
  getEntityIdFromTransactionReceipt,
  getTransactionFromBytes,
  getPropagationButtonLabel,
  isAccountId,
  convertBytes,
} from '@renderer/utils';
import { isUserLoggedIn, isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import DatePicker, { DatePickerInstance } from '@vuepic/vue-datepicker';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import KeyField from '@renderer/components/KeyField.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);
const datePicker = ref<DatePickerInstance>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(new Date());
const maxTransactionFee = ref<Hbar>(new Hbar(2));

const memo = ref('');
const expirationTimestamp = ref();
const content = ref('');
const ownerKey = ref<Key | null>(null);
const fileName = ref('');
const description = ref('');
const transactionMemo = ref('');

const fileMeta = ref<File | null>(null);
const fileReader = ref<FileReader | null>(null);
const fileBuffer = ref<Uint8Array | null>(null);
const loadPercentage = ref(0);

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

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
    if (file.size >= TRANSACTION_MAX_SIZE) {
      toast.error(
        `File too large (${convertBytes(file.size)}), Hedera max transaction size is: ${convertBytes(TRANSACTION_MAX_SIZE)}`,
        { position: 'bottom-right' },
      );
      return;
    }

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

    if (!ownerKey.value) {
      throw Error('Key is required');
    }

    transaction.value = createTransaction();
    await transactionProcessor.value?.process(transactionKey.value);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleExecuted = async (success: boolean, _response?, receipt?: TransactionReceipt) => {
  isExecuted.value = true;

  if (!success || !receipt) return;

  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  const fileTransaction = createTransaction();

  const newFileId = getEntityIdFromTransactionReceipt(receipt, 'fileId');

  const infoBytes = await createFileInfo({
    fileId: newFileId,
    size: fileTransaction.contents?.length || 0,
    expirationTime: fileTransaction.expirationTime,
    isDeleted: false,
    keys: fileTransaction.keys || [],
    fileMemo: memo.value,
    ledgerId: network.client.ledgerId,
  });

  const file: Prisma.HederaFileUncheckedCreateInput = {
    file_id: newFileId,
    user_id: user.personal.id,
    contentBytes: fileTransaction.contents?.join(','),
    metaBytes: infoBytes.join(','),
    lastRefreshed: new Date(),
    nickname: fileName.value,
    description: description.value,
    network: network.network,
  };

  await add(file);
  toast.success(`File ${newFileId} linked`, { position: 'bottom-right' });
};

const handleLoadFromDraft = async () => {
  if (!router.currentRoute.value.query.draftId) return;

  const draft = await getDraft(router.currentRoute.value.query.draftId?.toString() || '');
  const draftTransaction = getTransactionFromBytes<FileCreateTransaction>(draft.transactionBytes);

  if (draft) {
    transaction.value = draftTransaction;

    if (draftTransaction.keys) {
      ownerKey.value = new KeyList(draftTransaction.keys);
    }

    content.value = draftTransaction.contents
      ? new TextDecoder().decode(draftTransaction.contents)
      : '';
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

const handleSubmit = (id: number) => {
  isSubmitted.value = true;
  router.push({
    name: 'transactionDetails',
    params: { id },
  });
};

const handleLocalStored = (id: string) => {
  toast.success('File Create Transaction Executed', { position: 'bottom-right' });
  redirectToDetails(id);
};

/* Functions */
function createTransaction() {
  const transaction = new FileCreateTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(new Hbar(maxTransactionFee.value || 0))
    .setFileMemo(memo.value);

  if (ownerKey.value) {
    transaction.setKeys(
      ownerKey.value instanceof KeyList ? ownerKey.value : new KeyList([ownerKey.value]),
    );
  }

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }
  if (expirationTimestamp.value)
    transaction.setExpirationTime(Timestamp.fromDate(new Date(expirationTimestamp.value)));

  if (transactionMemo.value.length > 0 && transactionMemo.value.length <= MEMO_MAX_LENGTH) {
    transaction.setTransactionMemo(transactionMemo.value);
  }

  if (content.value.length > 0) {
    transaction.setContents(content.value);
  }

  if (fileBuffer.value) {
    transaction.setContents(fileBuffer.value);
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
  await handleLoadFromDraft();
});

/* Watchers */
watch(payerData.isValid, isValid => {
  if (isValid && payerData.key.value && !router.currentRoute.value.query.draftId) {
    ownerKey.value = payerData.key.value;
  }
});
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <TransactionHeaderControls heading-text="Create File Transaction">
        <template #buttons>
          <SaveDraftButton
            :get-transaction-bytes="() => createTransaction().toBytes()"
            :is-executed="isExecuted || isSubmitted"
          />
          <AppButton
            color="primary"
            type="submit"
            data-testid="button-sign-and-submit-file-create"
            :disabled="!ownerKey || !payerData.isValid.value"
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
            placeholder="Enter Transaction Memo"
            data-testid="input-transaction-memo-for-file-create"
          />
        </div>
      </div>

      <hr class="separator my-5" />

      <div class="fill-remaining">
        <div class="row">
          <div class="form-group col-8 col-xxxl-6">
            <KeyField
              :model-key="ownerKey"
              @update:model-key="key => (ownerKey = key)"
              is-required
            />
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <label class="form-label">File Memo</label>
            <AppInput
              v-model="memo"
              type="text"
              :filled="true"
              data-testid="input-memo-for-file-create"
              maxlength="100"
              placeholder="Enter file memo"
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
              data-testid="input-expiration-time-for-file"
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

        <div class="mt-6 form-group">
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
              class="form-control is-fill"
              rows="10"
              data-testid="textarea-file-content"
            ></textarea>
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-4 col-xxxl-3">
            <label class="form-label">Name</label>

            <div class="">
              <AppInput
                v-model="fileName"
                :filled="true"
                data-testid="input-file-name-for-file-create"
                placeholder="Enter File Name"
              />
            </div>
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-12 col-xl-8">
            <label class="form-label">Description</label>
            <textarea
              v-model="description"
              class="form-control is-fill"
              rows="5"
              data-testid="input-file-description-for-file-create"
              placeholder="Enter File Description"
            ></textarea>
          </div>
        </div>

        <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
          <div class="form-group col-12 col-xxxl-8">
            <label class="form-label">Observers</label>
            <UsersGroup v-model:userIds="observers" :addable="true" :editable="true" />
          </div>
        </div>

        <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
          <div class="form-group col-12 col-xxxl-8">
            <label class="form-label">Approvers</label>
            <ApproversList v-model:approvers="approvers" :editable="true" />
          </div>
        </div>
      </div>
    </form>

    <TransactionProcessor
      ref="transactionProcessor"
      :transaction-bytes="transaction?.toBytes() || null"
      :observers="observers"
      :approvers="approvers"
      :on-executed="handleExecuted"
      :on-submitted="handleSubmit"
      :on-local-stored="handleLocalStored"
    >
      <template #successHeading>File created successfully</template>
      <template #successContent>
        <p
          v-if="transactionProcessor?.transactionResult"
          class="text-small d-flex justify-content-between align-items mt-2"
        >
          <span class="text-bold text-secondary">File ID:</span>
          <span>{{
            getEntityIdFromTransactionReceipt(
              transactionProcessor.transactionResult.receipt,
              'fileId',
            )
          }}</span>
        </p>
      </template>
    </TransactionProcessor>
  </div>
</template>
