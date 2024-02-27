<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Hbar, Key, KeyList, Transaction, TransferTransaction } from '@hashgraph/sdk';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';
import useUserStore from '@renderer/stores/storeUser';

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
import AccountIdsSelect from '@renderer/components/AccountIdsSelect.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';

/* Stores */
const keyPairs = useKeyPairsStore();
const user = useUserStore();

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
const maxTransactionFee = ref(2);

const amount = ref(0);
const isApprovedTransfer = ref(false);
const keyStructureComponentKey = ref<Key | null>(null);

const isKeyStructureModalShown = ref(false);

const isExecuted = ref(false);

/* Handlers */
const handleCreate = async e => {
  e.preventDefault();
  try {
    if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
      throw Error('Invalid Payer ID');
    }

    if (!isAccountId(senderData.accountId.value) || !senderData.key.value) {
      throw Error('Invalid Sender ID');
    }

    if (!isAccountId(receiverData.accountId.value) || !receiverData.key.value) {
      throw Error('Invalid Receiver ID');
    }

    transaction.value = createTransaction();

    const requiredKey = new KeyList([payerData.key.value]);

    if (!isApprovedTransfer.value) {
      requiredKey.push(senderData.key.value);
    }
    if (receiverData.accountInfo.value?.receiverSignatureRequired) {
      requiredKey.push(receiverData.key.value);
    }

    await transactionProcessor.value?.process(requiredKey);
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
      const transactionId = draftTransaction.transactionId;

      if (transactionId.accountId) {
        payerData.accountId.value = transactionId.accountId.toString();
      }
      if (transactionId.validStart) {
        validStart.value = getDateTimeLocalInputValue(transactionId.validStart.toDate());
      }
    }

    if (draftTransaction.maxTransactionFee) {
      maxTransactionFee.value = draftTransaction.maxTransactionFee.toBigNumber().toNumber();
    }

    draftTransaction.hbarTransfers._map.forEach((value, accoundId) => {
      const hbars = value.toBigNumber().toNumber();

      amount.value = Math.abs(hbars);

      if (hbars < 0) {
        senderData.accountId.value = accoundId;
      } else {
        receiverData.accountId.value = accoundId;
      }
    });
  }
};

/* Functions */
function createTransaction() {
  const transaction = new TransferTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(new Hbar(maxTransactionFee.value));

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  if (isAccountId(receiverData.accountId.value)) {
    transaction.addHbarTransfer(receiverData.accountId.value, new Hbar(amount.value));
  }

  const isSenderValid = isAccountId(senderData.accountId.value);

  if (isApprovedTransfer.value) {
    isSenderValid &&
      transaction?.addApprovedHbarTransfer(
        senderData.accountId.value,
        new Hbar(amount.value).negated(),
      );
  } else {
    isSenderValid &&
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
        <template v-if="user.data.mode === 'personal'">
          <AccountIdsSelect v-model:account-id="payerData.accountId.value" :select-default="true" />
        </template>
        <template v-else>
          <AppInput
            :model-value="payerData.accountIdFormatted.value"
            @update:model-value="v => (payerData.accountId.value = v)"
            :filled="true"
            placeholder="Enter Payer ID"
          />
        </template>
      </div>
      <div class="form-group form-group" :class="[columnClass]">
        <label class="form-label">Valid Start Time <span class="text-danger">*</span></label>
        <AppInput v-model="validStart" type="datetime-local" step="1" :filled="true" />
      </div>
      <div class="form-group form-group" :class="[columnClass]">
        <label class="form-label">Max Transaction Fee</label>
        <AppInput v-model="maxTransactionFee" type="number" min="0" :filled="true" />
      </div>
    </div>

    <div class="row align-items-end mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Sender ID <span class="text-danger">*</span></label>
        <label v-if="senderData.isValid.value" class="form-label d-block text-secondary"
          >Balance: {{ senderData.accountInfo.value?.balance || 0 }}</label
        >

        <AppInput
          :model-value="senderData.accountIdFormatted.value"
          @update:model-value="v => (senderData.accountId.value = v)"
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
        senderData.accountId.value = '';
        receiverData.accountId.value = '';
        validStart = '';
        maxTransactionFee = 2;
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
