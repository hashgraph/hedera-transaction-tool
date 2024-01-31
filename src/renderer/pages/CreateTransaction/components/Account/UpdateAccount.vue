<script setup lang="ts">
import { computed, ref, reactive, watch, onMounted } from 'vue';
import { AccountId, AccountUpdateTransaction, KeyList, PublicKey, Hbar } from '@hashgraph/sdk';

import useNetworkStore from '../../../../stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '../../../../composables/useAccountId';

import { createTransactionId } from '../../../../services/transactionService';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppSwitch from '../../../../components/ui/AppSwitch.vue';
import AppInput from '../../../../components/ui/AppInput.vue';
import KeyStructureModal from '../../../../components/KeyStructureModal.vue';
import TransactionProcessor from '../../../../components/Transaction/TransactionProcessor.vue';

/* Stores */
const payerData = useAccountId();
const accountData = useAccountId();
const networkStore = useNetworkStore();

/* Composables */
const route = useRoute();
const toast = useToast();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<AccountUpdateTransaction | null>(null);
const validStart = ref('');
const maxTransactionfee = ref(2);

const newAccountData = reactive<{
  receiverSignatureRequired: boolean;
  maxAutomaticTokenAssociations: number;
  stakedAccountId: string;
  stakedNodeId: string;
  declineStakingReward: boolean;
  memo: string;
}>({
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  stakedAccountId: '',
  stakedNodeId: '',
  declineStakingReward: false,
  memo: '',
});
const newOwnerKeyText = ref('');
const newOwnerKeys = ref<string[]>([]);

const isKeyStructureModalShown = ref(false);

/* Computed */
const newOwnerKeyList = computed(
  () => new KeyList(newOwnerKeys.value.map(key => PublicKey.fromString(key))),
);

/* Handlers */
const handleAdd = () => {
  newOwnerKeys.value.push(newOwnerKeyText.value);
  newOwnerKeys.value = newOwnerKeys.value.filter(key => {
    try {
      return PublicKey.fromString(key);
    } catch (error) {
      return false;
    }
  });
  newOwnerKeyText.value = '';
};

const handleCreate = async e => {
  e.preventDefault();

  try {
    if (!accountData.accountInfo.value) {
      throw Error('Invalid Account');
    }

    transaction.value = new AccountUpdateTransaction()
      .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(new Hbar(maxTransactionfee.value))
      .setNodeAccountIds([new AccountId(3)])
      .setAccountId(accountData.accountId.value)
      .setReceiverSignatureRequired(newAccountData.receiverSignatureRequired)
      .setDeclineStakingReward(newAccountData.declineStakingReward)
      .setMaxAutomaticTokenAssociations(Number(newAccountData.maxAutomaticTokenAssociations))
      .setAccountMemo(newAccountData.memo || '');

    newOwnerKeys.value.length > 0 && transaction.value.setKey(newOwnerKeyList.value);

    if (
      newAccountData.stakedAccountId &&
      newAccountData.stakedAccountId.length > 0 &&
      !newAccountData.stakedNodeId &&
      accountData.accountInfo.value.stakedAccountId?.toString() !== newAccountData.stakedAccountId
    ) {
      transaction.value.setStakedAccountId(AccountId.fromString(newAccountData.stakedAccountId));
    }

    if (
      newAccountData.stakedAccountId !==
        accountData.accountInfo.value.stakedAccountId?.toString() &&
      newAccountData.stakedAccountId?.length === 0
    ) {
      transaction.value.clearStakedAccountId();
    }

    if (
      newAccountData.stakedNodeId &&
      !newAccountData.stakedAccountId &&
      accountData.accountInfo.value.stakedNodeId?.toString() !==
        newAccountData.stakedNodeId.toString()
    ) {
      transaction.value.setStakedNodeId(Number(newAccountData.stakedNodeId));
    }

    if (
      newAccountData.stakedNodeId?.toString() !==
        accountData.accountInfo.value.stakedNodeId?.toString() &&
      !newAccountData.stakedNodeId
    ) {
      transaction.value.clearStakedNodeId();
    }

    transaction.value.freezeWith(networkStore.client);

    const requiredSignatures = payerData.keysFlattened.value.concat(
      accountData.keysFlattened.value,
      newOwnerKeys.value,
    );
    await transactionProcessor.value?.process(requiredSignatures);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

/* Hooks */
onMounted(() => {
  if (route.query.accountId) {
    accountData.accountId.value = route.query.accountId.toString();
  }
});

/* Watchers */
watch(accountData.accountInfo, accountInfo => {
  if (!accountInfo) {
    newAccountData.receiverSignatureRequired = false;
    newAccountData.maxAutomaticTokenAssociations = 0;
    newAccountData.stakedAccountId = '';
    newAccountData.stakedNodeId = '';
    newAccountData.declineStakingReward = false;
    newAccountData.memo = '';
  } else {
    newAccountData.receiverSignatureRequired = accountInfo.receiverSignatureRequired;
    newAccountData.maxAutomaticTokenAssociations = accountInfo.maxAutomaticTokenAssociations || 0;
    newAccountData.stakedAccountId = accountInfo.stakedAccountId?.toString() || '';
    newAccountData.stakedNodeId =
      accountInfo.stakedNodeId === 0 ? '' : accountInfo.stakedNodeId?.toString() || '';
    newAccountData.declineStakingReward = accountInfo.declineReward;
    newAccountData.memo = accountInfo.memo || '';
  }
});
</script>
<template>
  <form @submit="handleCreate">
    <div class="d-flex justify-content-between align-items-center">
      <h2 class="text-title text-bold">Update Account Transaction</h2>

      <div class="d-flex justify-content-end align-items-center">
        <AppButton
          color="primary"
          type="submit"
          :disabled="!accountData.accountId.value || !payerData.isValid.value"
          >Sign & Submit</AppButton
        >
      </div>
    </div>

    <div class="mt-4 d-flex flex-wrap gap-5">
      <div class="form-group col-4">
        <label class="form-label">Set Payer ID (Required)</label>
        <label v-if="payerData.isValid.value" class="d-block form-label text-secondary"
          >Balance: {{ payerData.accountInfo.value?.balance || 0 }}</label
        >
        <AppInput
          :model-value="payerData.accountIdFormatted.value"
          @update:model-value="v => (payerData.accountId.value = v)"
          :filled="true"
          placeholder="Enter Payer ID"
        />
      </div>
      <div class="form-group">
        <label class="form-label">Set Valid Start Time (Required)</label>
        <AppInput v-model="validStart" type="datetime-local" step="1" :filled="true" />
      </div>
      <div class="form-group">
        <label class="form-label">Set Max Transaction Fee (Optional)</label>
        <AppInput v-model="maxTransactionfee" type="number" min="0" :filled="true" />
      </div>
    </div>
    <div class="mt-4 form-group">
      <label class="form-label">Set Account ID (Required)</label>
      <AppInput
        :model-value="accountData.accountIdFormatted.value"
        @update:model-value="v => (accountData.accountId.value = v)"
        :filled="true"
        placeholder="Enter Account ID"
      />
    </div>
    <div class="mt-4" v-if="accountData.key.value">
      <AppButton
        color="secondary"
        type="button"
        size="small"
        @click="isKeyStructureModalShown = true"
        >View Key Structure</AppButton
      >
    </div>
    <div class="mt-4 form-group w-75">
      <label class="form-label">Set Key/s (Optional)</label>
      <div class="d-flex gap-3">
        <AppInput
          v-model="newOwnerKeyText"
          :filled="true"
          placeholder="Enter new owner public key"
          style="max-width: 555px"
          @keypress="e => e.code === 'Enter' && handleAdd()"
        />
        <AppButton color="secondary" type="button" class="rounded-4" @click="handleAdd"
          >Add</AppButton
        >
      </div>
    </div>
    <div class="mt-4 w-75">
      <template v-for="key in newOwnerKeys" :key="key">
        <div class="d-flex align-items-center gap-3">
          <AppInput readonly :filled="true" :model-value="key" style="max-width: 555px" />
          <i
            class="bi bi-x-lg d-inline-block cursor-pointer"
            style="line-height: 16px"
            @click="newOwnerKeys = newOwnerKeys.filter(k => k !== key)"
          ></i>
        </div>
      </template>
    </div>
    <div class="mt-4 form-group w-50">
      <AppSwitch
        v-model:checked="newAccountData.receiverSignatureRequired"
        size="md"
        name="receiver-signature"
        label="Receiver Signature Required"
      />
    </div>
    <div class="mt-4 form-group w-50">
      <label class="form-label">Set Max Automatic Token Associations (Optional)</label>
      <AppInput
        v-model="newAccountData.maxAutomaticTokenAssociations"
        :min="0"
        :max="5000"
        :filled="true"
        type="number"
        placeholder="Enter timestamp"
      />
    </div>
    <div class="mt-4 form-group w-50">
      <label class="form-label">Set Staked Account Id (Optional)</label>
      <AppInput
        v-model="newAccountData.stakedAccountId"
        :disabled="Boolean(newAccountData.stakedNodeId)"
        :filled="true"
        placeholder="Enter Account Id"
      />
    </div>
    <div class="mt-4 form-group w-50">
      <label class="form-label">Set Staked Node Id (Optional)</label>
      <AppInput
        v-model="newAccountData.stakedNodeId"
        :disabled="
          Boolean(newAccountData.stakedAccountId && newAccountData.stakedAccountId.length > 0)
        "
        :filled="true"
        placeholder="Enter Node Id"
      />
    </div>
    <div class="mt-4 form-group w-50">
      <AppSwitch
        v-model:checked="newAccountData.declineStakingReward"
        size="md"
        name="decline-signature"
        label="Decline Staking Reward"
      />
    </div>
    <div class="mt-4 form-group w-50">
      <label class="form-label">Set Account Memo (Optional)</label>
      <AppInput
        v-model="newAccountData.memo"
        :filled="true"
        maxlength="100"
        placeholder="Enter Account Memo"
      />
    </div>
  </form>

  <TransactionProcessor
    ref="transactionProcessor"
    :transaction-bytes="transaction?.toBytes() || null"
    :on-close-success-modal-click="() => $router.push({ name: 'accounts' })"
  >
    <template #successHeading>Account updated successfully</template>
    <template #successContent>
      <p
        v-if="transactionProcessor?.transactionResult"
        class="text-small d-flex justify-content-between align-items mt-2"
      >
        <span class="text-bold text-secondary">Account ID:</span>
        <span>{{ accountData.accountId.value }}</span>
      </p>
    </template>
  </TransactionProcessor>

  <KeyStructureModal
    v-if="accountData.isValid.value"
    v-model:show="isKeyStructureModalShown"
    :account-key="accountData.key.value"
  />
</template>
