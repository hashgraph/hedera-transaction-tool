<script setup lang="ts">
import { ref } from 'vue';
import { AccountId, KeyList, PublicKey, Hbar, Key, TransferTransaction } from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { createTransactionId } from '../../../../services/transactionService';

import TransactionProcessor from '../../../../components/TransactionProcessor.vue';
import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import KeyStructure from '../../../../components/KeyStructure.vue';
import AppSwitch from '../../../../components/ui/AppSwitch.vue';

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
const validStart = ref('');
const maxTransactionfee = ref(2);

const amount = ref(0);
const isApprovedTransfer = ref(false);
const keyStructureComponentKey = ref<Key | null>(null);

const isKeyStructureModalShown = ref(false);

/* Handlers */
const handleCreate = async () => {
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
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-title text-bold">Transfer Hbar Transaction</span>
      </div>
    </div>
    <div class="mt-4">
      <div class="mt-4 d-flex flex-wrap gap-5">
        <div class="form-group col-4">
          <label class="form-label"
            >Set {{ isApprovedTransfer ? 'Spender' : 'Payer' }} ID (Required)</label
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
          <input
            :value="payerData.accountIdFormatted.value"
            @input="payerData.accountId.value = ($event.target as HTMLInputElement).value"
            type="text"
            class="form-control is-fill"
            :placeholder="`Enter ${isApprovedTransfer ? 'Spender' : 'Payer'} ID`"
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
        <label class="form-label">Set Sender ID</label>
        <label
          v-if="senderData.isValid.value"
          class="form-label text-secondary border-start border-1 ms-2 ps-2"
          >Balance: {{ senderData.accountInfo.value?.balance || 0 }}</label
        >
        <input
          :value="senderData.accountIdFormatted.value"
          @input="senderData.accountId.value = ($event.target as HTMLInputElement).value"
          type="text"
          class="form-control is-fill"
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
        <label class="form-label">Set Receiver ID</label>
        <label
          v-if="receiverData.isValid.value"
          class="form-label text-secondary border-start border-1 ms-2 ps-2"
          >Balance: {{ receiverData.accountInfo.value?.balance || 0 }}</label
        >
        <input
          :value="receiverData.accountIdFormatted.value"
          @input="receiverData.accountId.value = ($event.target as HTMLInputElement).value"
          type="text"
          class="form-control is-fill"
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
        <label class="form-label">Amount</label>
        <input
          v-model="amount"
          type="number"
          class="form-control is-fill"
          placeholder="Enter Amount"
        />
      </div>
      <div class="mt-4">
        <AppSwitch
          v-model:checked="isApprovedTransfer"
          name="is-approved-transfer"
          size="md"
          label="Approved Transfer (Transaction payer is the allowance spender)"
        />
      </div>
      <div class="mt-4">
        <AppButton
          color="primary"
          size="large"
          :disabled="
            !payerData.accountId.value ||
            !senderData.accountId.value ||
            !receiverData.accountId.value ||
            amount < 0
          "
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
          maxTransactionfee = 2;
          senderData.accountId.value = '';
          receiverData.accountId.value = '';
          amount = 0;
          transaction = null;
        }
      "
    >
      <template #successHeading>Hbar transferred successfully</template>
      <template #successContent>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Sender Account ID:</span>
          <span>{{ senderData.accountId.value }}</span>
        </p>
        <p class="mt-2 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Receiver Account ID:</span>
          <span>{{ receiverData.accountId.value }}</span>
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
