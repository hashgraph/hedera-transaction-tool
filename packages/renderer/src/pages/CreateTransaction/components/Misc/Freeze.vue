<script setup lang="ts">
import {ref} from 'vue';
// import { AccountId, Hbar, FreezeTransaction, FileId, Timestamp, FreezeType } from '@hashgraph/sdk';
import {AccountId, Hbar, FreezeTransaction, FileId, Timestamp} from '@hashgraph/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import {useToast} from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';

import {createTransactionId} from '@renderer/services/transactionService';

import {getDateTimeLocalInputValue} from '@renderer/utils';
import {isFileId} from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';

/* Stores */
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();

const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<FreezeTransaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionfee = ref(2);

const freezeType = ref(0);
const startTimestamp = ref(getDateTimeLocalInputValue(new Date()));
const fileId = ref<string>('');
const fileHash = ref('');

/* Handlers */
const handleCreate = async e => {
  e.preventDefault();

  try {
    transaction.value = new FreezeTransaction()
      .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      // .setFreezeType(FreezeType._fromCode(Number(freezeType.value)))
      .setStartTimestamp(Timestamp.fromDate(startTimestamp.value));

    isFileId(fileId.value) && transaction.value.setFileId(FileId.fromString(fileId.value));
    fileHash.value.trim().length > 0 && transaction.value.setFileHash(fileHash.value);

    transaction.value.freezeWith(networkStore.client);

    const requiredSignatures = payerData.keysFlattened.value.concat([]);

    await transactionProcessor.value?.process(requiredSignatures);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', {position: 'bottom-right'});
  }
};

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <form @submit="handleCreate">
    <!-- :create-requirements to be updated -->
    <TransactionHeaderControls
      :create-requirements="true"
      heading-text="Freeze Transaction"
    />

    <AppButton
      type="button"
      color="secondary"
      class="mt-6"
      @click="$router.back()"
    >
      <span class="bi bi-arrow-left"></span>
      Back
    </AppButton>

    <TransactionIdControls
      v-model:payer-id="payerData.accountId.value"
      v-model:valid-start="validStart"
      v-model:max-transaction-fee="maxTransactionfee"
      class="mt-6"
    />

    <div class="row mt-6">
      <div :class="[columnClass]">
        <label class="form-label">Freeze Type<span class="text-danger">*</span></label>
        <select
          class="form-select"
          v-model="freezeType"
        >
          <option value="0">Unknown Freeze Type</option>
          <option value="1">Freeze Only</option>
          <option value="2">Prepare Upgrade</option>
          <option value="3">Freeze Upgrade</option>
          <option value="4">Freeze Abort</option>
          <option value="5">Telemetry Upgrade</option>
        </select>
      </div>
    </div>

    <div class="row align-items-end mt-6">
      <div
        class="form-group"
        :class="[columnClass]"
      >
        <label class="form-label">Start Time<span class="text-danger">*</span></label>
        <AppInput
          :model-value="startTimestamp"
          @update:model-value="v => (startTimestamp = v)"
          :filled="true"
          type="datetime-local"
          step="1"
        />
      </div>
    </div>

    <div class="row align-items-end mt-6">
      <div
        class="form-group"
        :class="[columnClass]"
      >
        <label class="form-label">File ID</label>
        <AppInput
          :model-value="fileId?.toString()"
          @update:model-value="
            v => (fileId = isFileId(v) && v !== '0' ? FileId.fromString(v).toString() : v)
          "
          :filled="true"
          placeholder="Enter File ID"
        />
      </div>
    </div>

    <div class="row align-items-end mt-6">
      <div class="form-group col-8 col-xxxl-6">
        <label class="form-label">File Hash</label>
        <AppInput
          v-model="fileHash"
          :filled="true"
          placeholder="Enter File Hash"
        />
      </div>
    </div>
  </form>

  <TransactionProcessor
    ref="transactionProcessor"
    :transaction-bytes="transaction?.toBytes() || null"
  >
    <template #successHeading>Freeze executed successfully</template>
    <template #successContent>
      <p
        v-if="transactionProcessor?.transactionResult"
        class="text-small d-flex justify-content-between align-items mt-2"
      >
        <span class="text-bold text-secondary">File ID:</span>
        <span>{{ fileId?.toString() }}</span>
      </p>
    </template>
  </TransactionProcessor>
</template>
