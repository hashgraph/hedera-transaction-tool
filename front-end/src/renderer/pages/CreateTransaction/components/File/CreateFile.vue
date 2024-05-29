<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import {
  FileCreateTransaction,
  Hbar,
  Key,
  KeyList,
  Timestamp,
  Transaction,
  TransactionReceipt,
} from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';
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
  isAccountId,
  getEntityIdFromTransactionReceipt,
  getTransactionFromBytes,
} from '@renderer/utils';
import { isUserLoggedIn, isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import DatePicker from '@vuepic/vue-datepicker';
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

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const isExecuted = ref(false);
const isSubmitted = ref(false);

/* Handlers */

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

    const requiredKey = new KeyList([payerData.key.value, ownerKey.value]);
    await transactionProcessor.value?.process(requiredKey);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleExecuted = async (_response, receipt: TransactionReceipt) => {
  isExecuted.value = true;

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

const handleSubmit = async () => {
  isSubmitted.value = true;
  router.push({
    name: 'transactions',
    query: {
      tab: 'Ready for Execution',
    },
  });
};

/* Functions */
function createTransaction() {
  const transaction = new FileCreateTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(new Hbar(maxTransactionFee.value || 0))
    .setContents(content.value)
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

  return transaction;
}

/* Hooks */
onMounted(async () => {
  await handleLoadFromDraft();
});

/* Watchers */
watch(payerData.isValid, isValid => {
  if (isValid && payerData.key.value) {
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
            <label class="form-label">Expiration Time</label>
            <DatePicker
              v-model="expirationTimestamp"
              data-testid="input-expiration-time-for-file"
              placeholder="Select Expiration Time"
              :clearable="false"
              :auto-apply="true"
              :config="{
                keepActionRow:
                  new Date() >= getMinimumExpirationTime() &&
                  new Date() <= getMaximumExpirationTime(),
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
              <template
                v-if="
                  new Date() >= getMinimumExpirationTime() &&
                  new Date() <= getMaximumExpirationTime()
                "
                #action-row
              >
                <div class="d-grid w-100">
                  <AppButton
                    color="secondary"
                    size="small"
                    type="button"
                    @click="$emit('update:validStart', new Date())"
                  >
                    Now
                  </AppButton>
                </div>
              </template>
            </DatePicker>
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-12 col-xl-8">
            <label class="form-label">File Contents</label>
            <textarea
              v-model="content"
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
      :on-close-success-modal-click="() => $router.push({ name: 'files' })"
      :on-executed="handleExecuted"
      :on-submitted="handleSubmit"
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
