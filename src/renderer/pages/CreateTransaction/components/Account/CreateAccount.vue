<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
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

import TransactionProcessor from '../../../../components/TransactionProcessor.vue';
import AppButton from '../../../../components/ui/AppButton.vue';
import AppSwitch from '../../../../components/ui/AppSwitch.vue';

/* Stores */
const user = useUserStore();
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<AccountCreateTransaction | null>(null);
const validStart = ref();
const maxTransactionfee = ref(2);

const accountData = reactive({
  accountId: '',
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  initialBalance: 0,
  stakedAccountId: '',
  stakedNodeId: '',
  declineStakingReward: false,
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

const handleCreate = async () => {
  try {
    transaction.value = new AccountCreateTransaction()
      .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .setKey(keyList.value)
      .setReceiverSignatureRequired(accountData.receiverSignatureRequired)
      .setDeclineStakingReward(accountData.declineStakingReward)
      .setInitialBalance(accountData.initialBalance)
      .setMaxAutomaticTokenAssociations(accountData.maxAutomaticTokenAssociations)
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
  await add(user.data.email, accountId);
  toast.success(`Account ${accountId} linked`, { position: 'bottom-right' });
};
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-title text-bold">Create Account Transaction</span>
      </div>
    </div>
    <div class="mt-4">
      <div class="mt-4 d-flex flex-wrap gap-5">
        <div class="form-group col-4">
          <label class="form-label">Set Payer ID (Required)</label>
          <label v-if="payerData.isValid.value" class="d-block form-label text-secondary"
            >Balance: {{ payerData.accountInfo.value?.balance || 0 }}</label
          >
          <input
            :value="payerData.accountIdFormatted.value"
            @input="payerData.accountId.value = ($event.target as HTMLInputElement).value"
            type="text"
            class="form-control"
            placeholder="Enter Payer ID"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Set Valid Start Time (Required)</label>
          <input v-model="validStart" type="datetime-local" step="1" class="form-control" />
        </div>
        <div class="form-group">
          <label class="form-label">Set Max Transaction Fee (Optional)</label>
          <input v-model="maxTransactionfee" type="number" min="0" class="form-control" />
        </div>
      </div>

      <div class="mt-4 form-group w-75">
        <label class="form-label">Set Key/s (Required)</label>
        <div class="d-flex gap-3">
          <input
            v-model="ownerKeyText"
            type="text"
            class="form-control"
            placeholder="Enter owner public key"
            style="max-width: 555px"
            @keypress="e => e.code === 'Enter' && handleAdd()"
          />
          <AppButton color="secondary" class="rounded-4" @click="handleAdd">Add</AppButton>
        </div>
      </div>
      <div class="mt-4 w-75">
        <template v-for="key in ownerKeys" :key="key">
          <div class="d-flex align-items-center gap-3">
            <input
              type="text"
              readonly
              class="form-control"
              :value="key"
              style="max-width: 555px"
            />
            <i
              class="bi bi-x-lg d-inline-block cursor-pointer"
              style="line-height: 16px"
              @click="ownerKeys = ownerKeys.filter(k => k !== key)"
            ></i>
          </div>
        </template>
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Initial Balance in HBar (Optional)</label>
        <input
          v-model="accountData.initialBalance"
          type="number"
          min="0"
          class="form-control"
          placeholder="Enter HBar amount"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <AppSwitch
          v-model:checked="accountData.receiverSignatureRequired"
          size="md"
          name="receiver-signature"
          label="Receiver Signature Required"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Max Automatic Token Associations (Optional)</label>
        <input
          v-model="accountData.maxAutomaticTokenAssociations"
          type="number"
          :min="0"
          :max="5000"
          class="form-control"
          placeholder="Enter timestamp"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Staked Account Id (Optional)</label>
        <input
          v-model="accountData.stakedAccountId"
          :disabled="Number(accountData.stakedNodeId) > 0"
          type="text"
          class="form-control"
          placeholder="Enter Account Id"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Staked Node Id (Optional)</label>
        <input
          v-model="accountData.stakedNodeId"
          :disabled="accountData.stakedAccountId.length > 0"
          type="number"
          min="0"
          class="form-control"
          placeholder="Enter Node Id"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <AppSwitch
          v-model:checked="accountData.declineStakingReward"
          size="md"
          name="decline-signature"
          label="Decline Staking Reward"
        />
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Account Memo (Optional)</label>
        <input
          v-model="accountData.memo"
          type="text"
          maxlength="100"
          class="form-control"
          placeholder="Enter Account Memo"
        />
      </div>
      <div class="mt-4">
        <AppButton
          color="primary"
          size="large"
          :disabled="keyList._keys.length === 0 || !payerData.isValid.value"
          @click="handleCreate"
          >Create</AppButton
        >
      </div>
    </div>
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
          class="mt-2 text-small d-flex justify-content-between align-items"
        >
          <span class="text-bold text-secondary">Account ID:</span>
          <span>{{
            new AccountId(transactionProcessor?.transactionResult.receipt.accountId).toString() ||
            ''
          }}</span>
        </p>
      </template>
    </TransactionProcessor>
  </div>
</template>
