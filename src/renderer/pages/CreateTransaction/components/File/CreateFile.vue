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

import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';
import { add } from '@renderer/services/filesService';

import { getDateTimeLocalInputValue } from '@renderer/utils';
import {
  createFileInfo,
  getMinimumExpirationTime,
  getMaximumExpirationTime,
} from '@renderer/utils/sdk';
import {
  getEntityIdFromTransactionReceipt,
  getTransactionFromBytes,
} from '@renderer/utils/transactions';
import { isAccountId } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import KeyField from '@renderer/components/KeyField.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const route = useRoute();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref<Hbar>(new Hbar(2));

const memo = ref('');
const expirationTimestamp = ref();
const content = ref('');
const ownerKey = ref<Key | null>(null);
const fileName = ref('');
const description = ref('');

const isExecuted = ref(false);

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
    user_id: user.data.id,
    contentBytes: fileTransaction.contents?.join(','),
    metaBytes: infoBytes.join(','),
    lastRefreshed: new Date(),
    nickname: fileName.value,
    description: description.value,
  };

  await add(file);
  toast.success(`File ${newFileId} linked`, { position: 'bottom-right' });
};

const handleLoadFromDraft = async () => {
  if (!route.query.draftId) return;

  const draft = await getDraft(route.query.draftId?.toString() || '');
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

    if (draftTransaction.expirationTime) {
      const expirationDate = draftTransaction.expirationTime.toDate();

      expirationTimestamp.value =
        expirationDate > getMinimumExpirationTime() && expirationDate < getMaximumExpirationTime()
          ? getDateTimeLocalInputValue(draftTransaction.expirationTime.toDate())
          : '';
    }
  }
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
  <form @submit="handleCreate">
    <TransactionHeaderControls heading-text="Create File Transaction">
      <template #buttons>
        <SaveDraftButton
          :get-transaction-bytes="() => createTransaction().toBytes()"
          :is-executed="isExecuted"
        />
        <AppButton color="primary" type="submit" :disabled="!ownerKey || !payerData.isValid.value">
          <span class="bi bi-send"></span>
          Sign & Submit</AppButton
        >
      </template>
    </TransactionHeaderControls>

    <TransactionIdControls
      v-model:payer-id="payerData.accountId.value"
      v-model:valid-start="validStart"
      v-model:max-transaction-fee="maxTransactionFee as Hbar"
      class="mt-6"
    />

    <div class="row mt-6">
      <div class="form-group col-8 col-xxxl-6">
        <KeyField :model-key="ownerKey" @update:model-key="key => (ownerKey = key)" is-required />
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
          placeholder="Enter memo"
        />
      </div>
    </div>

    <div class="row mt-6">
      <div class="form-group col-4 col-xxxl-3">
        <label class="form-label">Expiration Time</label>

        <div class="">
          <AppInput
            v-model="expirationTimestamp"
            type="datetime-local"
            step="any"
            :min="getDateTimeLocalInputValue(getMinimumExpirationTime())"
            :max="getDateTimeLocalInputValue(getMaximumExpirationTime())"
            :filled="true"
          />
        </div>
      </div>
    </div>

    <div class="row mt-6">
      <div class="form-group col-12 col-xl-8">
        <label class="form-label">File Contents</label>
        <textarea v-model="content" class="form-control is-fill" rows="10"></textarea>
      </div>
    </div>

    <div class="row mt-6">
      <div class="form-group col-4 col-xxxl-3">
        <label class="form-label">Name</label>

        <div class="">
          <AppInput v-model="fileName" :filled="true" placeholder="Enter File Name" />
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
          placeholder="Enter File Description"
        ></textarea>
      </div>
    </div>
  </form>

  <TransactionProcessor
    ref="transactionProcessor"
    :transaction-bytes="transaction?.toBytes() || null"
    :on-close-success-modal-click="() => $router.push({ name: 'files' })"
    :on-executed="handleExecuted"
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
</template>
