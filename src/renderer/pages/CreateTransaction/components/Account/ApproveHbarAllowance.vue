<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { AccountId, Hbar, Key, AccountAllowanceApproveTransaction } from '@hashgraph/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';
import { getDateTimeLocalInputValue } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import { isAccountId } from '@renderer/utils/validator';

/* Stores */
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();
const route = useRoute();
const payerData = useAccountId();
const ownerData = useAccountId();
const spenderData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<AccountAllowanceApproveTransaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref(2);

const amount = ref(0);
const keyStructureComponentKey = ref<Key | null>(null);

const isKeyStructureModalShown = ref(false);

/* Handlers */
const handleCreate = async e => {
  e.preventDefault();

  try {
    if (!ownerData.accountId.value || !ownerData.isValid.value) {
      throw Error('Invalid owner');
    }

    createTransaction();
    transaction.value?.freezeWith(networkStore.client);

    const requiredSignatures = payerData.keysFlattened.value.concat(ownerData.keysFlattened.value);
    await transactionProcessor.value?.process(requiredSignatures);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleLoadFromDraft = () => {
  const draft = getDraft<AccountAllowanceApproveTransaction>(route.query.draftId?.toString() || '');

  if (draft) {
    transaction.value = draft.transaction;

    if (draft.transaction.transactionId) {
      payerData.accountId.value =
        draft.transaction.transactionId.accountId?.toString() || payerData.accountId.value;
    }

    if (draft.transaction.maxTransactionFee) {
      maxTransactionFee.value = draft.transaction.maxTransactionFee.toBigNumber().toNumber();
    }

    if (draft.transaction.hbarApprovals.length > 0) {
      const hbarApproval = draft.transaction.hbarApprovals[0];

      ownerData.accountId.value = hbarApproval.ownerAccountId?.toString() || '';
      spenderData.accountId.value = hbarApproval.spenderAccountId?.toString() || '';
      amount.value = hbarApproval.amount?.toBigNumber().toNumber() || 0;
    }
  }
};

/* Functions */
function createTransaction() {
  transaction.value = new AccountAllowanceApproveTransaction()
    .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(new Hbar(maxTransactionFee.value))
    .setNodeAccountIds([new AccountId(3)]);

  if (
    ownerData.accountId.value &&
    isAccountId(ownerData.accountId.value) &&
    spenderData.accountId.value &&
    isAccountId(spenderData.accountId.value)
  ) {
    transaction.value.approveHbarAllowance(
      ownerData.accountId.value,
      spenderData.accountId.value,
      new Hbar(amount.value),
    );
  }
  return transaction.value.toBytes();
}

/* Hooks */
onMounted(() => {
  handleLoadFromDraft();
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <form @submit="handleCreate">
    <TransactionHeaderControls
      :get-transaction-bytes="createTransaction"
      heading-text="Approve Hbar Allowance Transaction"
      :create-requirements="
        !payerData.isValid.value ||
        !ownerData.isValid.value ||
        !spenderData.isValid.value ||
        amount < 0
      "
    />

    <TransactionIdControls
      v-model:payer-id="payerData.accountId.value"
      v-model:valid-start="validStart"
      v-model:max-transaction-fee="maxTransactionFee"
      class="mt-6"
    />

    <div class="row align-items-end mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Owner ID <span class="text-danger">*</span></label>
        <label v-if="ownerData.isValid.value" class="form-label d-block text-secondary"
          >Balance: {{ ownerData.accountInfo.value?.balance }}</label
        >

        <AppInput
          :model-value="ownerData.accountIdFormatted.value"
          @update:model-value="v => (ownerData.accountId.value = v)"
          :filled="true"
          placeholder="Enter Owner ID"
        />
      </div>

      <div class="form-group" :class="[columnClass]" v-if="ownerData.key.value">
        <AppButton
          :outline="true"
          color="primary"
          type="button"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = ownerData.key.value;
          "
          >Show Key</AppButton
        >
      </div>
    </div>

    <div class="row align-items-end mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Spender ID <span class="text-danger">*</span></label>
        <label v-if="spenderData.isValid.value" class="form-label d-block text-secondary"
          >Allowance: {{ ownerData.getSpenderAllowance(spenderData.accountId.value) }}</label
        >
        <AppInput
          :model-value="spenderData.accountIdFormatted.value"
          @update:model-value="v => (spenderData.accountId.value = v)"
          :filled="true"
          placeholder="Enter Spender ID"
        />
      </div>
      <div class="form-group" :class="[columnClass]" v-if="spenderData.key.value">
        <AppButton
          :outline="true"
          color="primary"
          type="button"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = spenderData.key.value;
          "
          >Show Key</AppButton
        >
      </div>
    </div>

    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Amount <span class="text-danger">*</span></label>
        <AppInput v-model="amount" :filled="true" type="number" placeholder="Enter Amount" />
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
        ownerData.accountId.value = '';
        spenderData.accountId.value = '';
        amount = 0;
        transaction = null;
      }
    "
  >
    <template #successHeading>Allowance Approved Successfully</template>
    <template #successContent>
      <p class="text-small d-flex justify-content-between align-items mt-2">
        <span class="text-bold text-secondary">Owner Account ID:</span>
        <span>{{ ownerData.accountId.value }}</span>
      </p>
      <p class="text-small d-flex justify-content-between align-items mt-2">
        <span class="text-bold text-secondary">Spender Account ID:</span>
        <span>{{ spenderData.accountId.value }}</span>
      </p>
    </template>
  </TransactionProcessor>

  <KeyStructureModal
    v-model:show="isKeyStructureModalShown"
    :account-key="keyStructureComponentKey"
  />
</template>
