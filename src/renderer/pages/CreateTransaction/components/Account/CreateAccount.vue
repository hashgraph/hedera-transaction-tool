<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  AccountId,
  AccountCreateTransaction,
  KeyList,
  PublicKey,
  Hbar,
  TransactionReceipt,
} from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import useUserStore from '../../../../stores/storeUser';
import useNetworkStore from '../../../../stores/storeNetwork';

import { add } from '../../../../services/accountsService';
import { createTransactionId } from '../../../../services/transactionService';

import { getDateTimeLocalInputValue } from '../../../../utils';

import TransactionProcessor from '../../../../components/TransactionProcessor.vue';
import AppButton from '../../../../components/ui/AppButton.vue';
import AppSwitch from '../../../../components/ui/AppSwitch.vue';
import AppInput from '../../../../components/ui/AppInput.vue';
import TransactionIdControls from '@renderer/components/TransactionIdControls.vue';

/* Stores */
const user = useUserStore();
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<AccountCreateTransaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionfee = ref(2);

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

/* Getters */
const keyList = computed(() => new KeyList(ownerKeys.value.map(key => PublicKey.fromString(key))));

/* Handlers */
const handleAdd = () => {
  ownerKeys.value.push(ownerKeyText.value);
  ownerKeys.value = ownerKeys.value.filter(key => {
    try {
      return PublicKey.fromString(key);
    } catch (error) {
      return false;
    }
  });
  ownerKeyText.value = '';
};

const handleCreate = async e => {
  e.preventDefault();

  try {
    transaction.value = new AccountCreateTransaction()
      .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .setKey(keyList.value)
      .setReceiverSignatureRequired(accountData.receiverSignatureRequired)
      .setDeclineStakingReward(!accountData.acceptStakingRewards)
      .setInitialBalance(Number(accountData.initialBalance))
      .setMaxAutomaticTokenAssociations(Number(accountData.maxAutomaticTokenAssociations))
      .setAccountMemo(accountData.memo);

    accountData.stakedAccountId &&
      transaction.value.setStakedAccountId(AccountId.fromString(accountData.stakedAccountId));
    Number(accountData.stakedNodeId) > 0 &&
      transaction.value.setStakedNodeId(accountData.stakedNodeId);

    transaction.value.freezeWith(networkStore.client);

    const requiredSignatures = payerData.keysFlattened.value.concat(ownerKeys.value);
    await transactionProcessor.value?.process(requiredSignatures);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleExecuted = async ({ receipt }: { receipt: TransactionReceipt }) => {
  const accountId = new AccountId(receipt.accountId).toString() || '';
  await add(user.data.id, accountId);
  toast.success(`Account ${accountId} linked`, { position: 'bottom-right' });
};

/* Watchers */
watch(
  () => accountData.stakedAccountId,
  id => {
    try {
      if (id !== '0') {
        accountData.stakedAccountId = AccountId.fromString(id).toString();
      }
    } catch (error) {
      /* empty */
    }
  },
);
</script>
<template>
  <form @submit="handleCreate">
    <div class="d-flex justify-content-between align-items-center">
      <h2 class="text-title text-bold">Create Account Transaction</h2>

      <div class="d-flex justify-content-end align-items-center">
        <AppButton
          color="primary"
          type="submit"
          :disabled="keyList._keys.length === 0 || !payerData.isValid.value"
          >Sign & Submit</AppButton
        >
      </div>
    </div>

    <TransactionIdControls
      v-model:payer-id="payerData.accountId.value"
      v-model:valid-start="validStart"
      v-model:max-transaction-fee="maxTransactionfee"
      class="mt-4"
    />

    <hr class="separator my-6" />

    <div class="row">
      <div class="form-group col-8 col-xl-6">
        <label class="form-label">Keys</label>
        <div class="d-flex gap-3">
          <AppInput
            v-model="ownerKeyText"
            :filled="true"
            placeholder="Enter owner public key"
            @keypress="e => e.code === 'Enter' && handleAdd()"
          />
          <AppButton type="button" color="secondary" @click="handleAdd">Add</AppButton>
        </div>
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
      <div class="form-group col-8 col-md-5 col-xl-4 col-xxl-3">
        <label class="form-label">Set Staked Node Id (Optional)</label>
        <AppInput
          v-model="accountData.stakedNodeId"
          :disabled="accountData.stakedAccountId.length > 0"
          :filled="true"
          type="number"
          min="0"
          placeholder="Enter Node Id"
        />
      </div>
      <div class="form-group col-8 col-md-5 col-xl-4 col-xxl-3">
        <label class="form-label">Set Staked Account Id (Optional)</label>
        <AppInput
          v-model="accountData.stakedAccountId"
          :disabled="Number(accountData.stakedNodeId) > 0"
          :filled="true"
          placeholder="Enter Account Id"
        />
      </div>
    </div>
    <div class="row mt-6">
      <div class="form-group col-8 col-md-5 col-xl-4 col-xxl-3">
        <label class="form-label">Account Memo</label>
        <AppInput
          v-model="accountData.memo"
          :filled="true"
          maxlength="100"
          placeholder="Enter Account Memo"
        />
      </div>
    </div>

    <hr class="separator my-6" />

    <div class="form-group mt-6">
      <AppSwitch
        v-model:checked="accountData.receiverSignatureRequired"
        size="md"
        name="receiver-signature"
        label="Receiver Signature Required"
      />
    </div>

    <div class="row mt-6">
      <div class="form-group col-8 col-md-5 col-xl-4 col-xxl-3">
        <label class="form-label">Initial Balance in HBar</label>
        <AppInput
          v-model="accountData.initialBalance"
          :filled="true"
          type="number"
          min="0"
          placeholder="Enter Hbar amount"
        />
      </div>
      <div class="form-group col-8 col-md-5 col-xl-4 col-xxl-3">
        <label class="form-label">Set Max Automatic Token Associations</label>
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
          new AccountId(transactionProcessor?.transactionResult.receipt.accountId).toString() || ''
        }}</span>
      </p>
    </template>
  </TransactionProcessor>
</template>
