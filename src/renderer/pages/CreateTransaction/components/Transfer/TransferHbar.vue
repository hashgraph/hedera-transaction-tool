<script setup lang="ts">
import { ref } from 'vue';
import { AccountId, Hbar, Key, TransferTransaction } from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { createTransactionId } from '../../../../services/transactionService';
import { getDateTimeLocalInputValue } from '@renderer/utils';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppSwitch from '../../../../components/ui/AppSwitch.vue';
import AppInput from '../../../../components/ui/AppInput.vue';
import KeyStructureModal from '../../../../components/KeyStructureModal.vue';
import TransactionProcessor from '../../../../components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '../../../../components/Transaction/TransactionHeaderControls.vue';

/* Stores */
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();
const senderData = useAccountId();
const receiverData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<TransferTransaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionfee = ref(2);

const amount = ref(0);
const isApprovedTransfer = ref(false);
const keyStructureComponentKey = ref<Key | null>(null);

const isKeyStructureModalShown = ref(false);

/* Handlers */
const handleCreate = async e => {
  e.preventDefault();
  try {
    transaction.value = new TransferTransaction()
      .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .addHbarTransfer(receiverData.accountId.value, new Hbar(amount.value));

    if (isApprovedTransfer.value) {
      transaction.value.addApprovedHbarTransfer(
        senderData.accountId.value,
        new Hbar(amount.value).negated(),
      );
    } else {
      transaction.value.addHbarTransfer(
        senderData.accountId.value,
        new Hbar(amount.value).negated(),
      );
    }

    transaction.value.freezeWith(networkStore.client);

    let requiredSignatures = payerData.keysFlattened.value;

    if (!isApprovedTransfer.value) {
      requiredSignatures = requiredSignatures.concat(senderData.keysFlattened.value);
    }
    if (receiverData.accountInfo.value?.receiverSignatureRequired) {
      requiredSignatures = requiredSignatures.concat(receiverData.keysFlattened.value);
    }

    await transactionProcessor.value?.process(requiredSignatures);
  } catch (err: any) {
    console.log(err);

    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};
</script>
<template>
  <form @submit="handleCreate">
    <TransactionHeaderControls
      :create-requirements="
        !payerData.accountId.value ||
        !senderData.accountId.value ||
        !receiverData.accountId.value ||
        amount < 0
      "
      heading-text="Transfer Hbar Transaction"
    />

    <AppButton type="button" color="secondary" class="mt-6" @click="$router.back()">
      <span class="bi bi-arrow-left"></span>
      Back
    </AppButton>

    <div class="mt-4 d-flex flex-wrap gap-5">
      <div class="form-group col-4">
        <label class="form-label"
          >{{ isApprovedTransfer ? 'Spender' : 'Payer' }} ID
          <span class="text-danger">*</span></label
        >
        <label
          v-if="isApprovedTransfer && payerData.isValid.value"
          class="d-block form-label text-secondary"
          >Allowance: {{ senderData.getSpenderAllowance(payerData.accountId.value) }}</label
        >
        <label
          v-if="!isApprovedTransfer && payerData.isValid.value"
          class="d-block form-label text-secondary"
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
        <label class="form-label">Valid Start Time <span class="text-danger">*</span></label>
        <AppInput v-model="validStart" type="datetime-local" step="1" :filled="true" />
      </div>
      <div class="form-group">
        <label class="form-label">Max Transaction Fee</label>
        <AppInput v-model="maxTransactionfee" type="number" min="0" :filled="true" />
      </div>
    </div>
    <div class="mt-4 form-group">
      <label class="form-label">Sender ID <span class="text-danger">*</span></label>
      <label
        v-if="senderData.isValid.value"
        class="form-label text-secondary border-start border-1 ms-2 ps-2"
        >Balance: {{ senderData.accountInfo.value?.balance || 0 }}</label
      >
      <AppInput
        :value="senderData.accountIdFormatted.value"
        @input="senderData.accountId.value = ($event.target as HTMLInputElement).value"
        :filled="true"
        placeholder="Enter Sender ID"
      />
    </div>
    <div class="mt-4" v-if="senderData.key.value">
      <AppButton
        color="secondary"
        size="small"
        @click="
          isKeyStructureModalShown = true;
          keyStructureComponentKey = senderData.key.value;
        "
        >View Key Structure</AppButton
      >
    </div>
    <div class="mt-4 form-group">
      <label class="form-label">Receiver ID <span class="text-danger">*</span></label>
      <label
        v-if="receiverData.isValid.value"
        class="form-label text-secondary border-start border-1 ms-2 ps-2"
        >Balance: {{ receiverData.accountInfo.value?.balance || 0 }}</label
      >
      <AppInput
        :value="receiverData.accountIdFormatted.value"
        @input="receiverData.accountId.value = ($event.target as HTMLInputElement).value"
        :filled="true"
        placeholder="Enter Receiver ID"
      />
    </div>
    <div
      class="mt-4"
      v-if="receiverData.accountInfo.value?.receiverSignatureRequired && receiverData.key.value"
    >
      <AppButton
        color="secondary"
        size="small"
        @click="
          isKeyStructureModalShown = true;
          keyStructureComponentKey = receiverData.key.value;
        "
        >View Key Structure</AppButton
      >
    </div>
    <div class="mt-4 form-group">
      <label class="form-label">Amount <span class="text-danger">*</span></label>
      <AppInput v-model="amount" type="number" :filled="true" placeholder="Enter Amount" />
    </div>
    <div class="mt-4">
      <AppSwitch
        v-model:checked="isApprovedTransfer"
        name="is-approved-transfer"
        size="md"
        label="Approved Transfer (Transaction payer is the allowance spender)"
      />
    </div>
  </form>
  <TransactionProcessor
    ref="transactionProcessor"
    :transaction-bytes="transaction?.toBytes() || null"
    :on-close-success-modal-click="
      () => {
        payerData.accountId.value = '';
        senderData.accountId.value = '';
        receiverData.accountId.value = '';
        validStart = '';
        maxTransactionfee = 2;
        amount = 0;
        transaction = null;
      }
    "
  >
    <template #successHeading>Hbar transferred successfully</template>
    <template #successContent>
      <p class="text-small d-flex justify-content-between align-items mt-2">
        <span class="text-bold text-secondary">Sender Account ID:</span>
        <span>{{ senderData.accountId.value }}</span>
      </p>
      <p class="text-small d-flex justify-content-between align-items mt-2">
        <span class="text-bold text-secondary">Receiver Account ID:</span>
        <span>{{ receiverData.accountId.value }}</span>
      </p>
    </template>
  </TransactionProcessor>

  <KeyStructureModal
    v-model:show="isKeyStructureModalShown"
    :account-key="keyStructureComponentKey"
  />
</template>
