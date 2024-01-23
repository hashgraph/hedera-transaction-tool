<script setup lang="ts">
import { ref } from 'vue';
import {
  AccountId,
  KeyList,
  PublicKey,
  Hbar,
  Key,
  AccountAllowanceApproveTransaction,
} from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { createTransactionId } from '../../../../services/transactionService';

import TransactionProcessor from '../../../../components/TransactionProcessor.vue';
import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import KeyStructure from '../../../../components/KeyStructure.vue';

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
const maxTransactionfee = ref(2);

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
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
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
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-title text-bold">Approve Hbar Allowance Transaction</span>
      </div>
    </div>
    <form class="mt-4" @submit="handleCreate">
      <div class="mt-4 d-flex flex-wrap gap-5">
        <div class="form-group col-4">
          <label class="form-label">Set Payer ID (Required)</label>
          <label v-if="payerData.isValid.value" class="form-label text-secondary ms-3"
            >Balance: {{ payerData.accountInfo.value?.balance }}</label
          >
          <input
            :value="payerData.accountIdFormatted.value"
            @input="payerData.accountId.value = ($event.target as HTMLInputElement).value"
            type="text"
            class="form-control is-fill"
            placeholder="Enter Payer ID"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Set Valid Start Time (Required)</label>
          <input v-model="validStart" type="datetime-local" step="1" class="form-control is-fill" />
        </div>
        <div class="form-group">
          <label class="form-label">Set Max Transaction Fee (Optional)</label>
          <input v-model="maxTransactionfee" type="number" min="0" class="form-control is-fill" />
        </div>
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">Set Owner ID</label>
        <label
          v-if="ownerData.isValid.value"
          class="form-label text-secondary border-start border-1 ms-2 ps-2"
          >Balance: {{ ownerData.accountInfo.value?.balance }}</label
        >
        <input
          :value="ownerData.accountIdFormatted.value"
          @input="ownerData.accountId.value = ($event.target as HTMLInputElement).value"
          type="text"
          class="form-control is-fill"
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
        <label class="form-label">Set Spender ID</label>
        <label
          v-if="spenderData.isValid.value"
          class="form-label text-secondary border-start border-1 ms-2 ps-2"
          >Allowance: {{ ownerData.getSpenderAllowance(spenderData.accountId.value) }}</label
        >
        <input
          :value="spenderData.accountIdFormatted.value"
          @input="spenderData.accountId.value = ($event.target as HTMLInputElement).value"
          type="text"
          class="form-control is-fill"
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
        <label class="form-label">Amount</label>
        <input
          v-model="amount"
          type="number"
          class="form-control is-fill"
          placeholder="Enter Amount"
        />
      </div>
      <div class="mt-4">
        <AppButton
          color="primary"
          type="submit"
          size="large"
          :disabled="
            !payerData.isValid.value ||
            !ownerData.isValid.value ||
            !spenderData.isValid.value ||
            amount < 0
          "
          >Create</AppButton
        >
      </div>
    </form>
    <TransactionProcessor
      ref="transactionProcessor"
      :transaction-bytes="transaction?.toBytes() || null"
      :on-close-success-modal-click="
        () => {
          payerData.accountId.value = '';
          validStart = '';
          maxTransactionfee = 2;
          ownerData.accountId.value = '';
          spenderData.accountId.value = '';
          amount = 0;
          transaction = null;
        }
      "
    >
      <template #successHeading>Allowance Approved Successfully</template>
      <template #successContent>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Owner Account ID:</span>
          <span>{{ ownerData.accountId.value }}</span>
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Spender Account ID:</span>
          <span>{{ spenderData.accountId.value }}</span>
        </p>
      </template>
    </TransactionProcessor>
    <AppModal v-model:show="isKeyStructureModalShown" class="modal-fit-content">
      <div class="p-5">
        <KeyStructure
          v-if="keyStructureComponentKey instanceof KeyList && true"
          :key-list="keyStructureComponentKey"
        />
        <div v-else-if="keyStructureComponentKey instanceof PublicKey && true">
          {{ keyStructureComponentKey.toStringRaw() }}
        </div>
      </div>
    </AppModal>
  </div>
</template>
