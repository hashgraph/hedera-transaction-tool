<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  AccountId,
  AccountCreateTransaction,
  KeyList,
  PublicKey,
  Hbar,
  Transaction,
  TransactionReceipt,
} from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';

import { add } from '@renderer/services/accountsService';
import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';
import { flattenKeyList } from '@renderer/services/keyPairService';

import { getDateTimeLocalInputValue } from '@renderer/utils';
import { isAccountId, isPublicKey } from '@renderer/utils/validator';
import {
  getEntityIdFromTransactionReceipt,
  getTransactionFromBytes,
} from '@renderer/utils/transactions';

import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';

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
const ownerKeyText = ref('');
const ownerKeys = ref<string[]>([]);
const isExecuted = ref(false);
const nickname = ref('');

/* Getters */
const keyList = computed(() => new KeyList(ownerKeys.value.map(key => PublicKey.fromString(key))));

/* Handlers */
const handleAdd = () => {
  ownerKeys.value.push(ownerKeyText.value);
  ownerKeys.value = ownerKeys.value
    .filter(isPublicKey)
    .filter((pk, i) => ownerKeys.value.indexOf(pk) === i);
  ownerKeyText.value = '';
};

const handleCreate = async e => {
  e.preventDefault();

  try {
    if (!isAccountId(payerData.accountId.value)) {
      throw new Error('Invalid Payer ID');
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
  await add(user.data.id, accountId, nickname.value);
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
      ownerKeys.value = flattenKeyList(draftTransaction.key).map(pk => pk.toStringRaw());
    }
  }
};

/* Functions */
function createTransaction() {
  const transaction = new AccountCreateTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(new Hbar(maxTransactionFee.value))
    .setKey(keyList.value)
    .setReceiverSignatureRequired(accountData.receiverSignatureRequired)
    .setDeclineStakingReward(!accountData.acceptStakingRewards)
    .setInitialBalance(Hbar.fromString(accountData.initialBalance.toString()))
    .setMaxAutomaticTokenAssociations(Number(accountData.maxAutomaticTokenAssociations))
    .setAccountMemo(accountData.memo);

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
  if (isValid) {
    ownerKeyText.value = payerData.keysFlattened.value[0];
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
      :create-requirements="keyList._keys.length === 0 || !payerData.isValid.value"
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
        <label class="form-label">Keys <span class="text-danger">*</span></label>
        <div class="d-flex gap-3">
          <AppInput v-model="ownerKeyText" :filled="true" placeholder="Enter owner public key" />
        </div>
      </div>

      <div class="form-group col-4 col-xxxl-6 d-flex align-items-end">
        <AppButton :outline="true" type="button" color="primary" @click="handleAdd">Add</AppButton>
      </div>
    </div>

    <div class="row">
      <div class="form-group col-8 col-xxxl-6">
        <template v-for="key in ownerKeys" :key="key">
          <div class="d-flex align-items-center gap-3 mt-4">
            <AppInput readonly :filled="true" :model-value="key" />
            <i
              class="bi bi-x-lg cursor-pointer"
              @click="ownerKeys = ownerKeys.filter(k => k !== key)"
            ></i>
          </div>
        </template>
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

    <hr class="separator my-6" />

    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Nickname</label>
        <div class="">
          <AppInput v-model="nickname" :filled="true" />
        </div>
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
