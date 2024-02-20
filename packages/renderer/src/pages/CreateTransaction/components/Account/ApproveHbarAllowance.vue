<script setup lang="ts">
import {onMounted, ref} from 'vue';
import type {Key, Transaction} from '@hashgraph/sdk';
import {Hbar, AccountAllowanceApproveTransaction} from '@hashgraph/sdk';

import {useToast} from 'vue-toast-notification';
import {useRoute} from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import {createTransactionId} from '@renderer/services/transactionService';
import {getDraft} from '@renderer/services/transactionDraftsService';

import {getTransactionFromBytes} from '@renderer/utils/transactions';
import {getDateTimeLocalInputValue} from '@renderer/utils';
import {isAccountId} from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';

/* Composables */
const toast = useToast();
const route = useRoute();
const payerData = useAccountId();
const ownerData = useAccountId();
const spenderData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref(2);

const amount = ref(0);
const keyStructureComponentKey = ref<Key | null>(null);

const isKeyStructureModalShown = ref(false);

const isExecuted = ref(false);

/* Handlers */
const handleCreate = async e => {
  e.preventDefault();

  try {
    if (!isAccountId(payerData.accountId.value)) {
      throw Error('Invalid Payer ID');
    }

    if (!isAccountId(ownerData.accountId.value)) {
      throw Error('Invalid Owner ID');
    }

    if (!isAccountId(spenderData.accountId.value)) {
      throw Error('Invalid Spender ID');
    }

    transaction.value = createTransaction();

    const requiredSignatures = payerData.keysFlattened.value.concat(ownerData.keysFlattened.value);
    await transactionProcessor.value?.process(requiredSignatures);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', {position: 'bottom-right'});
  }
};

const handleLoadFromDraft = async () => {
  if (!route.query.draftId) return;

  const draft = await getDraft(route.query.draftId?.toString() || '');
  const draftTransaction = getTransactionFromBytes<AccountAllowanceApproveTransaction>(
    draft.transactionBytes,
  );

  if (draft) {
    transaction.value = draftTransaction;

    if (draftTransaction.transactionId) {
      payerData.accountId.value =
        draftTransaction.transactionId.accountId?.toString() || payerData.accountId.value;
    }

    if (draftTransaction.maxTransactionFee) {
      maxTransactionFee.value = draftTransaction.maxTransactionFee.toBigNumber().toNumber();
    }

    if (draftTransaction.hbarApprovals.length > 0) {
      const hbarApproval = draftTransaction.hbarApprovals[0];

      ownerData.accountId.value = hbarApproval.ownerAccountId?.toString() || '';
      spenderData.accountId.value = hbarApproval.spenderAccountId?.toString() || '';
      amount.value = hbarApproval.amount?.toBigNumber().toNumber() || 0;
    }
  }
};

/* Functions */
function createTransaction() {
  const transaction = new AccountAllowanceApproveTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(new Hbar(maxTransactionFee.value));

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  if (isAccountId(ownerData.accountId.value) && isAccountId(spenderData.accountId.value)) {
    transaction.approveHbarAllowance(
      ownerData.accountId.value,
      spenderData.accountId.value,
      new Hbar(amount.value),
    );
  }
  return transaction;
}

/* Hooks */
onMounted(async () => {
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
      <div
        class="form-group"
        :class="[columnClass]"
      >
        <label class="form-label">Owner ID <span class="text-danger">*</span></label>
        <label
          v-if="ownerData.isValid.value"
          class="form-label d-block text-secondary"
          >Balance: {{ ownerData.accountInfo.value?.balance }}</label
        >
        <AppInput
          :model-value="ownerData.accountIdFormatted.value"
          :filled="true"
          placeholder="Enter Owner ID"
          @update:model-value="v => (ownerData.accountId.value = v)"
        />
      </div>
      <div
        v-if="ownerData.key.value"
        class="form-group"
        :class="[columnClass]"
      >
        <AppButton
          :outline="true"
          color="primary"
          type="button"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = ownerData.key.value;
          "
        >
          Show Key
        </AppButton>
      </div>
    </div>

    <div class="row align-items-end mt-6">
      <div
        class="form-group"
        :class="[columnClass]"
      >
        <label class="form-label">Spender ID <span class="text-danger">*</span></label>
        <label
          v-if="spenderData.isValid.value"
          class="form-label d-block text-secondary"
          >Allowance: {{ ownerData.getSpenderAllowance(spenderData.accountId.value) }}</label
        >
        <AppInput
          :model-value="spenderData.accountIdFormatted.value"
          :filled="true"
          placeholder="Enter Spender ID"
          @update:model-value="v => (spenderData.accountId.value = v)"
        />
      </div>
      <div
        v-if="spenderData.key.value"
        class="form-group"
        :class="[columnClass]"
      >
        <AppButton
          :outline="true"
          color="primary"
          type="button"
          @click="
            isKeyStructureModalShown = true;
            keyStructureComponentKey = spenderData.key.value;
          "
        >
          Show Key
        </AppButton>
      </div>
    </div>

    <div class="row mt-6">
      <div
        class="form-group"
        :class="[columnClass]"
      >
        <label class="form-label">Amount <span class="text-danger">*</span></label>
        <AppInput
          v-model="amount"
          :filled="true"
          type="number"
          placeholder="Enter Amount"
        />
      </div>
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
        ownerData.accountId.value = '';
        spenderData.accountId.value = '';
        amount = 0;
        transaction = null;
      }
    "
    :on-executed="() => (isExecuted = true)"
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
