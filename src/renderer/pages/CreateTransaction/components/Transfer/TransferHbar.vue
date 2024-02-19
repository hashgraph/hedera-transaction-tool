<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AccountId, Hbar, Key, Transaction, TransferTransaction } from '@hashgraph/sdk';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';

import { getDateTimeLocalInputValue } from '@renderer/utils';
import { getTransactionFromBytes } from '@renderer/utils/transactions';
import { isAccountId } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';

/* Stores */
const keyPairs = useKeyPairsStore();

/* Composables */
const toast = useToast();
const route = useRoute();
const payerData = useAccountId();
const senderData = useAccountId();
const receiverData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionfee = ref(2);

const amount = ref(0);
const isApprovedTransfer = ref(false);
const keyStructureComponentKey = ref<Key | null>(null);

const isKeyStructureModalShown = ref(false);

const isExecuted = ref(false);

/* Handlers */
const handleCreate = async e => {
  e.preventDefault();
  try {
    transaction.value = createTransaction();

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

const handleLoadFromDraft = async () => {
  if (!route.query.draftId) return;

  const draft = await getDraft(route.query.draftId?.toString() || '');
  const draftTransaction = getTransactionFromBytes<TransferTransaction>(draft.transactionBytes);

  if (draft) {
    transaction.value = draftTransaction;

    if (draftTransaction.transactionId) {
      payerData.accountId.value =
        draftTransaction.transactionId.accountId?.toString() || payerData.accountId.value;
    }

    draftTransaction.hbarTransfers._map.forEach((value, accoundId) => {
      const hbars = value.toBigNumber().toNumber();

      if (hbars > 0) {
        receiverData.accountId.value = accoundId;
        amount.value = hbars;
      } else {
        senderData.accountId.value = accoundId;
      }
    });
  }
};

/* Functions */
function createTransaction() {
  const transaction = new TransferTransaction()
    .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
    .setNodeAccountIds([new AccountId(3)]);

  if (receiverData.accountId.value && isAccountId(receiverData.accountId.value)) {
    transaction.addHbarTransfer(receiverData.accountId.value, new Hbar(amount.value));
  }

  if (isApprovedTransfer.value) {
    senderData.accountId.value &&
      transaction?.addApprovedHbarTransfer(
        senderData.accountId.value,
        new Hbar(amount.value).negated(),
      );
  } else {
    senderData.accountId.value &&
      transaction?.addHbarTransfer(senderData.accountId.value, new Hbar(amount.value).negated());
  }

  return transaction;
}

/* Hooks */
onMounted(async () => {
  const allAccountIds = keyPairs.accoundIds.map(a => a.accountIds).flat();
  if (allAccountIds.length > 0) {
    payerData.accountId.value = allAccountIds[0];
  }

  await handleLoadFromDraft();
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <form @submit="handleCreate">
    <TransactionHeaderControls
      :get-transaction-bytes="() => createTransaction().toBytes()"
      :is-executed="isExecuted"
      :create-requirements="
        !payerData.accountId.value ||
        !senderData.accountId.value ||
        !receiverData.accountId.value ||
        amount < 0
      "
      heading-text="Transfer Hbar Transaction"
      class="flex-1"
    />

    <div class="row flex-wrap align-items-end mt-6">
      <div class="form-group" :class="[columnClass]">
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
      <div class="form-group form-group" :class="[columnClass]">
        <label class="form-label">Valid Start Time <span class="text-danger">*</span></label>
        <AppInput v-model="validStart" type="datetime-local" step="1" :filled="true" />
      </div>
      <div class="form-group form-group" :class="[columnClass]">
        <label class="form-label">Max Transaction Fee</label>
        <AppInput v-model="maxTransactionfee" type="number" min="0" :filled="true" />
      </div>
    </div>

    <div class="row align-items-end mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Sender ID <span class="text-danger">*</span></label>
        <label v-if="senderData.isValid.value" class="form-label d-block text-secondary"
          >Balance: {{ senderData.accountInfo.value?.balance || 0 }}</label
        >
        <AppInput
          :value="senderData.accountIdFormatted.value"
          @input="senderData.accountId.value = ($event.target as HTMLInputElement).value"
          :filled="true"
          placeholder="Enter Sender ID"
        />
      </div>

      <div class="form-group mt-6" :class="[columnClass]" v-if="senderData.key.value">
        <AppButton
          :outline="true"
          color="primary"
          type="button"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = senderData.key.value;
          "
          >Show Key</AppButton
        >
      </div>
    </div>

    <div class="row align-items-end mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Receiver ID <span class="text-danger">*</span></label>
        <label v-if="receiverData.isValid.value" class="form-label d-block text-secondary"
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
        class="form-group mt-6"
        :class="[columnClass]"
        v-if="receiverData.accountInfo.value?.receiverSignatureRequired && receiverData.key.value"
      >
        <AppButton
          :outline="true"
          color="primary"
          type="button"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = receiverData.key.value;
          "
          >Show Key</AppButton
        >
      </div>
    </div>

    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Amount <span class="text-danger">*</span></label>
        <AppInput v-model="amount" type="number" :filled="true" placeholder="Enter Amount" />
      </div>
    </div>

    <div class="mt-6">
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
    :on-executed="() => (isExecuted = true)"
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
