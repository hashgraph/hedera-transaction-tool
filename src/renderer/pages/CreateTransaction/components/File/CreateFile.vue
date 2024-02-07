<script setup lang="ts">
import { computed, ref } from 'vue';
import { AccountId, FileCreateTransaction, KeyList, PublicKey, Timestamp } from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';
import useUserStore from '../../../../stores/storeUser';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { createTransactionId } from '../../../../services/transactionService';
import { add } from '../../../../services/filesService';

import { getDateTimeLocalInputValue } from '@renderer/utils';
import { getEntityIdFromTransactionResult } from '@renderer/utils/transactions';
import { isPublicKey } from '@renderer/utils/validator';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppInput from '../../../../components/ui/AppInput.vue';
import TransactionProcessor from '../../../../components/Transaction/TransactionProcessor.vue';
import TransactionIdControls from '../../../../components/Transaction/TransactionIdControls.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';

/* Stores */
const network = useNetworkStore();
const user = useUserStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<FileCreateTransaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
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
  ownerKeys.value = [...new Set(ownerKeys.value.filter(isPublicKey))];
  ownerKeyText.value = '';
};

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

    transaction.value.freezeWith(network.client);

    const requiredSignatures = payerData.keysFlattened.value.concat(ownerKeys.value);
    await transactionProcessor.value?.process(requiredSignatures);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleExecuted = async result => {
  await add(user.data.id, getEntityIdFromTransactionResult(result, 'fileId'));
};
</script>
<template>
  <form @submit="handleCreate">
    <TransactionHeaderControls
      :create-requirements="keyList._keys.length === 0 || !payerData.isValid.value"
      heading-text="Create File Transaction"
    />

    <AppButton type="button" color="secondary" class="mt-6" @click="$router.back()">
      <span class="bi bi-arrow-left"></span>
      Back
    </AppButton>

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
          <AppInput
            v-model="ownerKeyText"
            :filled="true"
            placeholder="Enter owner public key"
            @keypress="e => e.code === 'Enter' && handleAdd()"
          />
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
