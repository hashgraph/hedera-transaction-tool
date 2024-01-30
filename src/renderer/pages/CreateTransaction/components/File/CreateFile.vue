<script setup lang="ts">
import { computed, ref } from 'vue';
import { AccountId, FileCreateTransaction, KeyList, PublicKey, Timestamp } from '@hashgraph/sdk';

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

const transaction = ref<FileCreateTransaction | null>(null);
const validStart = ref('');
const maxTransactionFee = ref(2);

const ownerKeyText = ref('');
const memo = ref('');
const expirationTimestamp = ref();
const content = ref('');
const ownerKeys = ref<string[]>([]);

/* Getters */
const keyList = computed(() => new KeyList(ownerKeys.value.map(key => PublicKey.fromString(key))));

/* Handlers */
const handleAdd = () => {
  ownerKeys.value.push(ownerKeyText.value);
  ownerKeys.value = ownerKeys.value.filter(key => {
    try {
      return PublicKey.fromString(key);
    } catch (error) {
      return false;
    }
  });
  ownerKeyText.value = '';
};

// const handleFileImport = (e: Event) => {
//   const fileImportEl = e.target as HTMLInputElement;
//   const files = fileImportEl.files;

//   if (files && files.length > 0) {
//     const reader = new FileReader();
//     reader.onload = () => (content.value = reader.result?.toString() || '');
//     reader.readAsText(files[0]);
//   }
// };

const handleCreate = async e => {
  e.preventDefault();

  try {
    transaction.value = new FileCreateTransaction()
      .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(maxTransactionFee.value)
      .setNodeAccountIds([new AccountId(3)])
      .setKeys(keyList.value)
      .setContents(content.value)
      .setFileMemo(memo.value);

    if (expirationTimestamp.value)
      transaction.value.setExpirationTime(Timestamp.fromDate(expirationTimestamp.value));

    transaction.value.freezeWith(networkStore.client);

    const requiredSignatures = payerData.keysFlattened.value.concat(ownerKeys.value);
    await transactionProcessor.value?.process(requiredSignatures);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};
</script>
<template>
  <form @submit="handleCreate">
    <div class="d-flex justify-content-between align-items-center">
      <h2 class="text-title text-bold">Create File Transaction</h2>

      <div class="d-flex justify-content-end align-items-center">
        <AppButton
          color="primary"
          type="submit"
          :disabled="keyList._keys.length === 0 || !payerData.isValid.value"
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
    <div class="mt-4 form-group w-75">
      <label class="form-label">Set Keys (Required)</label>
      <div class="d-flex gap-3">
        <AppInput
          v-model="ownerKeyText"
          :filled="true"
          placeholder="Enter owner public key"
          style="max-width: 555px"
          @keypress="e => e.code === 'Enter' && handleAdd()"
        />
        <AppButton color="secondary" type="button" class="rounded-4" @click="handleAdd"
          >Add</AppButton
        >
      </div>
    </div>
    <div class="mt-4 w-75">
      <template v-for="key in ownerKeys" :key="key">
        <div class="d-flex align-items-center gap-3">
          <AppInput readonly :filled="true" :value="key" style="max-width: 555px" />
          <i
            class="bi bi-x-lg d-inline-block cursor-pointer"
            style="line-height: 16px"
            @click="ownerKeys = ownerKeys.filter(k => k !== key)"
          ></i>
        </div>
      </template>
    </div>
    <!-- <div class="mt-4 form-group w-50">
        <label class="form-label">Set File Memo (Optional)</label>
        <AppInput
          v-model="memo"
          type="text"
          :filled="true"
          maxlength="100"
          placeholder="Enter memo"
        />
      </div> -->
    <!-- <div class="mt-4 form-group w-25">
        <label class="form-label">Set Expiration Time (Optional)</label>
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
    <div class="mt-4 form-group w-75">
      <label class="form-label">Set File Contents</label>
      <textarea v-model="content" class="form-control is-fill" rows="10"></textarea>
    </div>
  </form>

  <TransactionProcessor
    ref="transactionProcessor"
    :transaction-bytes="transaction?.toBytes() || null"
    :on-close-success-modal-click="
      () => {
        payerData.accountId.value = '';
        validStart = '';
        maxTransactionFee = 2;
        ownerKeys = [];
        memo = '';
        expirationTimestamp = undefined;

        transaction = null;
      }
    "
  >
    <template #successHeading>File created successfully</template>
    <template #successContent>
      <p
        v-if="transactionProcessor?.transactionResult"
        class="text-small d-flex justify-content-between align-items mt-2"
      >
        <span class="text-bold text-secondary">File ID:</span>
        <span>{{
          new AccountId(transactionProcessor.transactionResult.receipt.fileId).toString() || ''
        }}</span>
      </p>
    </template>
  </TransactionProcessor>
</template>
