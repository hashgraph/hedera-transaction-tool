<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { FileCreateTransaction, KeyList, PublicKey, Timestamp, Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';
import { add } from '@renderer/services/filesService';
import { flattenKeyList } from '@renderer/services/keyPairService';

import { getDateTimeLocalInputValue } from '@renderer/utils';
import {
  getEntityIdFromTransactionResult,
  getTransactionFromBytes,
} from '@renderer/utils/transactions';
import { isAccountId, isPublicKey } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const route = useRoute();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref(2);

const ownerKeyText = ref('');
const memo = ref('');
const expirationTimestamp = ref();
const content = ref('');
const ownerKeys = ref<string[]>([]);

const isExecuted = ref(false);

/* Getters */
const keyList = computed(() => new KeyList(ownerKeys.value.map(key => PublicKey.fromString(key))));

/* Handlers */
const handleAdd = () => {
  ownerKeys.value.push(ownerKeyText.value);
  ownerKeys.value = [...new Set(ownerKeys.value.filter(isPublicKey))];
  ownerKeyText.value = '';
};

const handleCreate = async e => {
  e.preventDefault();

  try {
    if (!isAccountId(payerData.accountId.value)) {
      throw Error('Invalid Payer ID');
    }
    transaction.value = createTransaction();

    const requiredSignatures = payerData.keysFlattened.value.concat(ownerKeys.value);
    await transactionProcessor.value?.process(requiredSignatures);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleExecuted = async result => {
  isExecuted.value = true;
  await add(user.data.id, getEntityIdFromTransactionResult(result, 'fileId'));
};

const handleLoadFromDraft = async () => {
  if (!route.query.draftId) return;

  const draft = await getDraft(route.query.draftId?.toString() || '');
  const draftTransaction = getTransactionFromBytes<FileCreateTransaction>(draft.transactionBytes);

  if (draft) {
    transaction.value = draftTransaction;

    if (draftTransaction.transactionId) {
      payerData.accountId.value =
        draftTransaction.transactionId.accountId?.toString() || payerData.accountId.value;
    }

    if (draftTransaction.maxTransactionFee) {
      maxTransactionFee.value = draftTransaction.maxTransactionFee.toBigNumber().toNumber();
    }

    if (draftTransaction.keys) {
      ownerKeys.value = draftTransaction.keys
        .map(k => flattenKeyList(k).map(pk => pk.toStringRaw()))
        .flat();
    }

    content.value = draftTransaction.contents
      ? new TextDecoder().decode(draftTransaction.contents)
      : '';
    memo.value = draftTransaction.fileMemo || '';
  }
};

/* Functions */
function createTransaction() {
  const transaction = new FileCreateTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionFee.value)
    .setKeys(keyList.value)
    .setContents(content.value)
    .setFileMemo(memo.value);

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  if (expirationTimestamp.value)
    transaction.setExpirationTime(Timestamp.fromDate(expirationTimestamp.value));

  return transaction;
}

/* Hooks */
onMounted(async () => {
  await handleLoadFromDraft();
});

/* Watchers */
watch(payerData.isValid, isValid => {
  if (isValid) {
    ownerKeyText.value = payerData.keysFlattened.value[0];
  }
});
</script>
<template>
  <form @submit="handleCreate">
    <TransactionHeaderControls
      :get-transaction-bytes="() => createTransaction().toBytes()"
      :is-executed="isExecuted"
      :create-requirements="keyList._keys.length === 0 || !payerData.isValid.value"
      heading-text="Create File Transaction"
    />

    <TransactionIdControls
      v-model:payer-id="payerData.accountId.value"
      v-model:valid-start="validStart"
      v-model:max-transaction-fee="maxTransactionFee"
      class="mt-6"
    />

    <hr class="separator my-6" />

    <div class="row">
      <div class="form-group col-8 col-xxxl-6">
        <label class="form-label">Keys <span class="text-danger">*</span></label>
        <div class="d-flex gap-3">
          <AppInput v-model="ownerKeyText" :filled="true" placeholder="Enter owner public key" />
        </div>
      </div>

      <div class="form-group col-4 col-xxxl-6 d-flex align-items-end">
        <AppButton :outline="true" color="primary" type="button" @click="handleAdd">Add</AppButton>
      </div>
    </div>

    <div class="row">
      <div class="form-group col-8 col-xxxl-6">
        <template v-for="key in ownerKeys" :key="key">
          <div class="d-flex align-items-center gap-3 mt-3">
            <AppInput readonly :filled="true" :value="key" />
            <i
              class="bi bi-x-lg d-inline-block cursor-pointer"
              @click="ownerKeys = ownerKeys.filter(k => k !== key)"
            ></i>
          </div>
        </template>
      </div>
    </div>

    <!-- <div class="mt-4 form-group w-50">
        <label class="form-label">File Memo (Optional)</label>
        <AppInput
          v-model="memo"
          type="text"
          :filled="true"
          maxlength="100"
          placeholder="Enter memo"
        />
      </div> -->
    <!-- <div class="mt-4 form-group w-25">
        <label class="form-label">Expiration Time (Optional)</label>
        <AppInput
          v-model="expirationTimestamp"
          type="datetime-local"
          :filled="true"
          placeholder="Enter timestamp"
        />
      </div> -->
    <!-- <div class="mt-4 form-group w-25">
        <label for="fileUpload" class="form-label">
          <span for="fileUpload" class="btn btn-primary">Upload File (.json, .txt)</span>
        </label>
        <AppInput
          class="form-control form-control-sm is-fill"
          id="fileUpload"
          name="fileUpload"
          type="file"
          accept=".json,.txt"
          @change="handleFileImport"
        />
      </div> -->

    <div class="row mt-6">
      <div class="form-group col-12 col-xl-8">
        <label class="form-label">File Contents</label>
        <textarea v-model="content" class="form-control is-fill" rows="10"></textarea>
      </div>
    </div>
  </form>

  <TransactionProcessor
    ref="transactionProcessor"
    :transaction-bytes="transaction?.toBytes() || null"
    :on-close-success-modal-click="
      () => {
        validStart = '';
        maxTransactionFee = 2;
        ownerKeys = [];
        memo = '';
        expirationTimestamp = undefined;

        transaction = null;
      }
    "
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
          getEntityIdFromTransactionResult(transactionProcessor.transactionResult, 'fileId')
        }}</span>
      </p>
    </template>
  </TransactionProcessor>
</template>
