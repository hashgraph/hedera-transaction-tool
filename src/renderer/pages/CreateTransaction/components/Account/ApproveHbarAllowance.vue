<script setup lang="ts">
import { ref } from 'vue';
import { AccountId, Hbar, Key, AccountAllowanceApproveTransaction } from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { createTransactionId } from '../../../../services/transactionService';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppInput from '../../../../components/ui/AppInput.vue';
import TransactionProcessor from '../../../../components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '../../../../components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '../../../../components/Transaction/TransactionIdControls.vue';
import KeyStructureModal from '../../../../components/KeyStructureModal.vue';

/* Stores */
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();
const ownerData = useAccountId();
const spenderData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<AccountAllowanceApproveTransaction | null>(null);
const validStart = ref('');
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

    transaction.value = new AccountAllowanceApproveTransaction()
      .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionFee.value))
      .setNodeAccountIds([new AccountId(3)])
      .approveHbarAllowance(
        ownerData.accountId.value,
        spenderData.accountId.value,
        new Hbar(amount.value),
      )
      .freezeWith(networkStore.client);

    const requiredSignatures = payerData.keysFlattened.value.concat(ownerData.keysFlattened.value);
    await transactionProcessor.value?.process(requiredSignatures);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};
</script>
<template>
  <form @submit="handleCreate">
    <TransactionHeaderControls
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

    <div class="mt-4 form-group">
      <label class="form-label">Owner ID <span class="text-danger">*</span></label>
      <label
        v-if="ownerData.isValid.value"
        class="form-label text-secondary border-start border-1 ms-2 ps-2"
        >Balance: {{ ownerData.accountInfo.value?.balance }}</label
      >
      <AppInput
        :model-value="ownerData.accountIdFormatted.value"
        @update:model-value="v => (ownerData.accountId.value = v)"
        :filled="true"
        placeholder="Enter Owner ID"
      />
    </div>
    <div class="mt-4" v-if="ownerData.key.value">
      <AppButton
        color="secondary"
        type="button"
        size="small"
        @click="
          isKeyStructureModalShown = true;
          keyStructureComponentKey = ownerData.key.value;
        "
        >View Key Structure</AppButton
      >
    </div>
    <div class="mt-4 form-group">
      <label class="form-label">Spender ID <span class="text-danger">*</span></label>
      <label
        v-if="spenderData.isValid.value"
        class="form-label text-secondary border-start border-1 ms-2 ps-2"
        >Allowance: {{ ownerData.getSpenderAllowance(spenderData.accountId.value) }}</label
      >
      <AppInput
        :model-value="spenderData.accountIdFormatted.value"
        @update:model-value="v => (spenderData.accountId.value = v)"
        :filled="true"
        placeholder="Enter Spender ID"
      />
    </div>
    <div class="mt-4" v-if="spenderData.key.value">
      <AppButton
        color="secondary"
        type="button"
        size="small"
        @click="
          isKeyStructureModalShown = true;
          keyStructureComponentKey = spenderData.key.value;
        "
        >View Key Structure</AppButton
      >
    </div>
    <div class="mt-4 form-group">
      <label class="form-label">Amount <span class="text-danger">*</span></label>
      <AppInput v-model="amount" :filled="true" type="number" placeholder="Enter Amount" />
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
