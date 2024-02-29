<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import {
  AccountId,
  AccountCreateTransaction,
  Hbar,
  Transaction,
  TransactionReceipt,
  Key,
  KeyList,
  PublicKey,
} from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';

import { add } from '@renderer/services/accountsService';
import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';

import { getDateTimeLocalInputValue } from '@renderer/utils';
import { isAccountId } from '@renderer/utils/validator';
import {
  getEntityIdFromTransactionReceipt,
  getTransactionFromBytes,
} from '@renderer/utils/transactions';

import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import KeyField from '@renderer/components/KeyField.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const route = useRoute();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref(2);

const accountData = reactive({
  accountId: '',
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  initialBalance: 0,
  stakedAccountId: '',
  stakedNodeId: '',
  acceptStakingRewards: true,
  memo: '',
});
const ownerKey = ref<Key | null>(null);
const isExecuted = ref(false);

/* Handlers */

const handleCreate = async e => {
  e.preventDefault();

  try {
    if (!isAccountId(payerData.accountId.value)) {
      throw new Error('Invalid Payer ID');
    }

    if (!ownerKey.value) {
      throw new Error('Owner key is required');
    }

    transaction.value = createTransaction();

    await transactionProcessor.value?.process(payerData.key.value);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleExecuted = async (_response, receipt: TransactionReceipt) => {
  isExecuted.value = true;
  const accountId = getEntityIdFromTransactionReceipt(receipt, 'accountId');
  await add(user.data.id, accountId);
  toast.success(`Account ${accountId} linked`, { position: 'bottom-right' });
};

const handleLoadFromDraft = async () => {
  if (!route.query.draftId) return;

  const draft = await getDraft(route.query.draftId.toString());
  const draftTransaction = getTransactionFromBytes<AccountCreateTransaction>(
    draft.transactionBytes,
  );

  if (draft) {
    transaction.value = draftTransaction;

    accountData.receiverSignatureRequired = draftTransaction.receiverSignatureRequired;
    accountData.maxAutomaticTokenAssociations =
      draftTransaction.maxAutomaticTokenAssociations.toNumber();
    accountData.initialBalance = draftTransaction.initialBalance?.toBigNumber().toNumber() || 0;
    accountData.stakedAccountId = draftTransaction.stakedAccountId?.toString() || '';

    if (draftTransaction.stakedNodeId) {
      accountData.stakedNodeId = draftTransaction.stakedNodeId.toNumber();
    }

    accountData.acceptStakingRewards = !draftTransaction.declineStakingRewards;
    accountData.memo = draftTransaction.accountMemo || '';

    if (draftTransaction.key) {
      ownerKey.value = draftTransaction.key;
    }
  }
};

const handleOwnerKeyUpdate = key => {
  console.log(key);
};

/* Functions */
function createTransaction() {
  const transaction = new AccountCreateTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(new Hbar(maxTransactionFee.value))
    .setReceiverSignatureRequired(accountData.receiverSignatureRequired)
    .setDeclineStakingReward(!accountData.acceptStakingRewards)
    .setInitialBalance(Hbar.fromString(accountData.initialBalance.toString()))
    .setMaxAutomaticTokenAssociations(Number(accountData.maxAutomaticTokenAssociations))
    .setAccountMemo(accountData.memo);

  if (ownerKey.value) {
    transaction.setKey(ownerKey.value);
  }

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  isAccountId(accountData.stakedAccountId) &&
    transaction.setStakedAccountId(AccountId.fromString(accountData.stakedAccountId));
  Number(accountData.stakedNodeId) > 0 &&
    transaction.setStakedNodeId(Number(accountData.stakedNodeId));

  return transaction;
}

/* Hooks */
onMounted(async () => {
  await handleLoadFromDraft();
});

/* Watchers */
watch(
  () => accountData.stakedAccountId,
  id => {
    if (isAccountId(id) && id !== '0') {
      accountData.stakedAccountId = AccountId.fromString(id).toString();
    }
  },
);

watch(payerData.isValid, isValid => {
  if (isValid && payerData.key.value) {
    // ownerKey.value = payerData.key.value;

    const publicKey1 = PublicKey.fromString(
      '61f37fc1bbf3ff4453712ee6a305c5c7255955f7889ec3bf30426f1863158ef4',
    );
    const publicKey2 = PublicKey.fromString(
      'f6e076efe91ff0e92d77799397da70b315c8e513de4afdf41bede21a7239e1cf',
    );
    const publicKey3 = PublicKey.fromString(
      '025dbb2eeb98dff5c8461d6c22466cdb3097730744a42cec79f6ac666fa90187e2',
    );

    // Key List 1
    const keyList1 = new KeyList([publicKey1, publicKey2, publicKey3]); // user & user

    // Key List 2
    const keyList2 = new KeyList([keyList1, publicKey3], 1); // multisig & user

    // Key List 3
    const keyList3 = new KeyList([keyList2, publicKey1], 2); // multisig & user & user

    // Key List 4
    const keyList4 = new KeyList([keyList3, keyList2], 2); // multisig & multisig

    // Key List 5
    const keyList5 = new KeyList([keyList4, publicKey3], 1); // multisig & multisig

    // const publicKey1 = PublicKey.fromString(
    //   '61f37fc1bbf3ff4453712ee6a305c5c7255955f7889ec3bf30426f1863158ef4',
    // );
    // const publicKey2 = PublicKey.fromString(
    //   'f6e076efe91ff0e92d77799397da70b315c8e513de4afdf41bede21a7239e1cf',
    // );

    // // Key List 1
    // const keyList1 = new KeyList([publicKey1, publicKey2]); // user & user

    // // Key List 3
    // const keyList3 = new KeyList([keyList1, publicKey1], 2); // multisig & user & user

    // // Key List 4
    // const keyList4 = new KeyList([keyList3, keyList1], 2); // multisig & multisig

    // // Key List 5
    // const keyList5 = new KeyList([publicKey1, keyList4, publicKey2], 1); // multisig & multisig

    ownerKey.value = keyList5;
  }
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <form @submit="handleCreate">
    <TransactionHeaderControls
      :get-transaction-bytes="() => createTransaction().toBytes()"
      :is-executed="isExecuted"
      :create-requirements="!ownerKey || !payerData.isValid.value"
      heading-text="Create Account Transaction"
      class="flex-1"
    />

    <TransactionIdControls
      v-model:payer-id="payerData.accountId.value"
      v-model:valid-start="validStart"
      v-model:max-transaction-fee="maxTransactionFee"
      class="mt-6"
    />

    <hr class="separator my-6" />

    <div class="row">
      <div class="form-group col-8 col-xxxl-6">
        <KeyField :model-key="ownerKey" @update:model-key="handleOwnerKeyUpdate" is-required />
      </div>
    </div>

    <hr class="separator my-6" />

    <div class="form-group">
      <AppSwitch
        v-model:checked="accountData.acceptStakingRewards"
        size="md"
        name="accept-staking-awards"
        label="Accept Staking Awards"
      />
    </div>
    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Staked Node Id</label>
        <AppInput
          v-model="accountData.stakedNodeId"
          :disabled="accountData.stakedAccountId.length > 0"
          :filled="true"
          type="number"
          min="0"
          placeholder="Enter Node Id Number"
        />
      </div>
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Staked Account Id</label>
        <AppInput
          v-model="accountData.stakedAccountId"
          :disabled="Number(accountData.stakedNodeId) > 0"
          :filled="true"
          placeholder="Enter Account Id"
        />
      </div>
    </div>
    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Account Memo</label>
        <AppInput
          v-model="accountData.memo"
          :filled="true"
          maxlength="100"
          placeholder="Enter Memo"
        />
      </div>
    </div>

    <hr class="separator my-6" />

    <div>
      <AppSwitch
        v-model:checked="accountData.receiverSignatureRequired"
        size="md"
        name="receiver-signature"
        label="Receiver Signature Required"
      />
    </div>

    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Initial Balance in HBar</label>
        <AppInput
          v-model="accountData.initialBalance"
          :filled="true"
          type="number"
          min="0"
          placeholder="Enter Hbar amount"
        />
      </div>
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Max Automatic Token Associations</label>
        <AppInput
          v-model="accountData.maxAutomaticTokenAssociations"
          :min="0"
          :max="5000"
          :filled="true"
          type="number"
          placeholder="Enter Max Token Auto Associations"
        />
      </div>
    </div>
  </form>

  <TransactionProcessor
    ref="transactionProcessor"
    :transaction-bytes="transaction?.toBytes() || null"
    :on-executed="handleExecuted"
    :on-close-success-modal-click="() => $router.push({ name: 'accounts' })"
  >
    <template #successHeading>Account created successfully</template>
    <template #successContent>
      <p
        v-if="transactionProcessor?.transactionResult"
        class="text-small d-flex justify-content-between align-items mt-2"
      >
        <span class="text-bold text-secondary">Account ID:</span>
        <span>{{
          getEntityIdFromTransactionReceipt(
            transactionProcessor?.transactionResult.receipt,
            'accountId',
          )
        }}</span>
      </p>
    </template>
  </TransactionProcessor>
</template>
