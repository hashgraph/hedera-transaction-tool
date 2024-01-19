<script setup lang="ts">
import { computed, ref } from 'vue';
import { AccountId, FileCreateTransaction, KeyList, PublicKey, Timestamp } from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { createTransactionId } from '../../../../services/transactionService';

import TransactionProcessor from '../../../../components/TransactionProcessor.vue';
import AppButton from '../../../../components/ui/AppButton.vue';

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

const handleCreate = async () => {
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
    toast.error(err.message || 'Failed to create transaction', { position: 'top-right' });
  }
};
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-title text-bold">Create File Transaction</span>
      </div>
    </div>
    <div class="mt-4">
      <div class="mt-4 d-flex flex-wrap gap-5">
        <div class="form-group col-4">
          <label class="form-label">Set Payer ID (Required)</label>
          <label v-if="payerData.isValid.value" class="d-block form-label text-secondary"
            >Balance: {{ payerData.accountInfo.value?.balance || 0 }}</label
          >
          <input
            :value="payerData.accountIdFormatted.value"
            @input="payerData.accountId.value = ($event.target as HTMLInputElement).value"
            type="text"
            class="form-control"
            placeholder="Enter Payer ID"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Set Valid Start Time (Required)</label>
          <input v-model="validStart" type="datetime-local" step="1" class="form-control" />
        </div>
        <div class="form-group">
          <label class="form-label">Set Max Transaction Fee (Optional)</label>
          <input v-model="maxTransactionFee" type="number" min="0" class="form-control" />
        </div>
      </div>
      <div class="mt-4 form-group w-75">
        <label class="form-label">Set Keys (Required)</label>
        <div class="d-flex gap-3">
          <input
            v-model="ownerKeyText"
            type="text"
            class="form-control"
            placeholder="Enter owner public key"
            style="max-width: 555px"
            @keypress="e => e.code === 'Enter' && handleAdd()"
          />
          <AppButton color="secondary" class="rounded-4" @click="handleAdd">Add</AppButton>
        </div>
      </div>
      <div class="mt-4 w-75">
        <template v-for="key in ownerKeys" :key="key">
          <div class="d-flex align-items-center gap-3">
            <input
              type="text"
              readonly
              class="form-control"
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
      <!-- <div class="mt-4 form-group w-50">
        <label class="form-label">Set File Memo (Optional)</label>
        <input
          v-model="memo"
          type="text"
          class="form-control"
          maxlength="100"
          placeholder="Enter memo"
        />
      </div> -->
      <!-- <div class="mt-4 form-group w-25">
        <label class="form-label">Set Expiration Time (Optional)</label>
        <input
          v-model="expirationTimestamp"
          type="datetime-local"
          class="form-control"
          placeholder="Enter timestamp"
        />
      </div> -->
      <!-- <div class="mt-4 form-group w-25">
        <label for="fileUpload" class="form-label">
          <span for="fileUpload" class="btn btn-primary">Upload File (.json, .txt)</span>
        </label>
        <input
          class="form-control form-control-sm"
          id="fileUpload"
          name="fileUpload"
          type="file"
          accept=".json,.txt"
          @change="handleFileImport"
        />
      </div> -->
      <div class="mt-4 form-group w-75">
        <label class="form-label">Set File Contents</label>
        <textarea v-model="content" class="form-control" rows="10"></textarea>
      </div>
      <div class="mt-4">
        <!-- <AppButton size="small" color="secondary" class="me-3 px-4 rounded-4">Save Draft</AppButton> -->
        <AppButton
          color="primary"
          size="large"
          :disabled="keyList._keys.length === 0 || !payerData.isValid.value"
          @click="handleCreate"
          >Create</AppButton
        >
      </div>
    </div>
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
          class="mt-2 text-small d-flex justify-content-between align-items"
        >
          <span class="text-bold text-secondary">File ID:</span>
          <span>{{
            new AccountId(transactionProcessor.transactionResult.receipt.fileId).toString() || ''
          }}</span>
        </p>
      </template>
    </TransactionProcessor>
  </div>
</template>
