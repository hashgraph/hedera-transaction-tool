<script setup lang="ts">
import { computed, ref, reactive, watch, onMounted } from 'vue';
import {
  AccountId,
  AccountUpdateTransaction,
  KeyList,
  PublicKey,
  Hbar,
  Transaction,
} from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';
import { flattenKeyList } from '@renderer/services/keyPairService';

import { getDateTimeLocalInputValue } from '@renderer/utils';
import { getTransactionFromBytes } from '@renderer/utils/transactions';
import { isAccountId, isPublicKey } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';

/* Stores */
const payerData = useAccountId();
const accountData = useAccountId();

/* Composables */
const route = useRoute();
const toast = useToast();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref(2);

const newAccountData = reactive<{
  receiverSignatureRequired: boolean;
  maxAutomaticTokenAssociations: number;
  stakedAccountId: string;
  stakedNodeId: string;
  acceptStakingAwards: boolean;
  memo: string;
}>({
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  stakedAccountId: '',
  stakedNodeId: '',
  acceptStakingAwards: false,
  memo: '',
});
const newOwnerKeyText = ref('');
const newOwnerKeys = ref<string[]>([]);

const isKeyStructureModalShown = ref(false);
const isExecuted = ref(false);

/* Computed */
const newOwnerKeyList = computed(
  () => new KeyList(newOwnerKeys.value.map(key => PublicKey.fromString(key))),
);

/* Handlers */
const handleAdd = () => {
  newOwnerKeys.value.push(newOwnerKeyText.value);
  newOwnerKeys.value = newOwnerKeys.value
    .filter(isPublicKey)
    .filter((pk, i) => newOwnerKeys.value.indexOf(pk) === i);
  newOwnerKeyText.value = '';
};

const handleCreate = async e => {
  e.preventDefault();

  try {
    if (!accountData.accountInfo.value) {
      throw Error('Invalid Account');
    }

    transaction.value = createTransaction();

    const requiredSignatures = payerData.keysFlattened.value.concat(
      accountData.keysFlattened.value,
      newOwnerKeys.value,
    );

    await transactionProcessor.value?.process(requiredSignatures);
  } catch (err: any) {
    console.log(err);

    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleLoadFromDraft = async () => {
  if (!route.query.draftId) return;

  const draft = await getDraft(route.query.draftId?.toString() || '');
  const draftTransaction = await getTransactionFromBytes<AccountUpdateTransaction>(
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

    accountData.accountId.value = draftTransaction.accountId?.toString() || '';

    newAccountData.receiverSignatureRequired = draftTransaction.receiverSignatureRequired;
    newAccountData.acceptStakingAwards = !draftTransaction.declineStakingRewards;
    newAccountData.maxAutomaticTokenAssociations =
      draftTransaction.maxAutomaticTokenAssociations.toNumber();
    newAccountData.memo = draftTransaction.accountMemo || '';

    if (draftTransaction.key) {
      newOwnerKeys.value = flattenKeyList(draftTransaction.key).map(pk => pk.toStringRaw());
    }

    if (draftTransaction.stakedAccountId?.toString() !== '0.0.0') {
      newAccountData.stakedAccountId = draftTransaction.stakedAccountId?.toString() || '';
    }

    if (draftTransaction.stakedNodeId >= 0) {
      newAccountData.stakedNodeId = draftTransaction.stakedNodeId.toNumber() || '';
    }
  }
};

/* Functions */
function createTransaction() {
  const transaction = new AccountUpdateTransaction()
    .setTransactionId(createTransactionId(payerData.accountId.value, validStart.value))
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(new Hbar(maxTransactionFee.value))
    .setReceiverSignatureRequired(newAccountData.receiverSignatureRequired)
    .setDeclineStakingReward(!newAccountData.acceptStakingAwards)
    .setMaxAutomaticTokenAssociations(Number(newAccountData.maxAutomaticTokenAssociations))
    .setAccountMemo(newAccountData.memo || '');

  accountData.accountId.value && transaction.setAccountId(accountData.accountId.value);
  newOwnerKeys.value.length > 0 && transaction.setKey(newOwnerKeyList.value);

  if (!newAccountData.stakedAccountId && !newAccountData.stakedNodeId) {
    transaction.clearStakedAccountId();
    transaction.clearStakedNodeId();
  }

  if (
    newAccountData.stakedAccountId &&
    newAccountData.stakedAccountId.length > 0 &&
    !newAccountData.stakedNodeId &&
    accountData.accountInfo.value?.stakedAccountId?.toString() !== newAccountData.stakedAccountId
  ) {
    transaction.setStakedAccountId(newAccountData.stakedAccountId);
  }

  if (
    newAccountData.stakedNodeId &&
    !newAccountData.stakedAccountId &&
    accountData.accountInfo.value?.stakedNodeId?.toString() !==
      newAccountData.stakedNodeId.toString()
  ) {
    transaction.setStakedNodeId(Number(newAccountData.stakedNodeId));
  }

  return transaction;
}

/* Hooks */
onMounted(async () => {
  if (route.query.accountId) {
    accountData.accountId.value = route.query.accountId.toString();
  }

  await handleLoadFromDraft();
});

/* Watchers */
watch(accountData.accountInfo, accountInfo => {
  if (!accountInfo) {
    newAccountData.receiverSignatureRequired = false;
    newAccountData.maxAutomaticTokenAssociations = 0;
    newAccountData.stakedAccountId = '';
    newAccountData.stakedNodeId = '';
    newAccountData.acceptStakingAwards = false;
    newAccountData.memo = '';
  } else {
    newAccountData.receiverSignatureRequired = accountInfo.receiverSignatureRequired;
    newAccountData.maxAutomaticTokenAssociations = accountInfo.maxAutomaticTokenAssociations || 0;
    newAccountData.stakedAccountId = accountInfo.stakedAccountId?.toString() || '';
    newAccountData.stakedNodeId =
      accountInfo.stakedNodeId === 0 ? '' : accountInfo.stakedNodeId?.toString() || '';
    newAccountData.acceptStakingAwards = !accountInfo.declineReward;
    newAccountData.memo = accountInfo.memo || '';
  }
});

watch(
  () => newAccountData.stakedAccountId,
  id => {
    if (isAccountId(id) && id !== '0') {
      newAccountData.stakedAccountId = AccountId.fromString(id).toString();
    }
  },
);
/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <form @submit="handleCreate">
    <TransactionHeaderControls
      :get-transaction-bytes="() => createTransaction().toBytes()"
      :is-executed="isExecuted"
      :create-requirements="!accountData.accountId.value || !payerData.isValid.value"
      heading-text="Update Account Transaction"
    />

    <TransactionIdControls
      v-model:payer-id="payerData.accountId.value"
      v-model:valid-start="validStart"
      v-model:max-transaction-fee="maxTransactionFee"
      class="mt-6"
    />

    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Account ID <span class="text-danger">*</span></label>

        <AppInput
          :model-value="accountData.accountIdFormatted.value"
          @update:model-value="v => (accountData.accountId.value = v)"
          :filled="true"
          placeholder="Enter Account ID"
        />
      </div>

      <div class="form-group mt-6" :class="[columnClass]">
        <AppButton
          v-if="accountData.key.value"
          :outline="true"
          class="text-nowrap"
          color="primary"
          type="button"
          @click="isKeyStructureModalShown = true"
          >Show Key</AppButton
        >
      </div>
    </div>

    <hr class="separator my-6" />

    <div class="row">
      <div class="form-group col-8 col-xxxl-6">
        <label class="form-label">Keys</label>
        <div class="d-flex gap-3">
          <AppInput
            v-model="newOwnerKeyText"
            :filled="true"
            placeholder="Enter new owner public key"
          />
        </div>
      </div>

      <div class="form-group col-4 col-xxxl-6 d-flex align-items-end">
        <AppButton :outline="true" color="primary" type="button" @click="handleAdd">Add</AppButton>
      </div>
    </div>

    <div class="row">
      <div class="form-group col-8 col-xxxl-6">
        <template v-for="key in newOwnerKeys" :key="key">
          <div class="d-flex align-items-center gap-3 mt-4">
            <AppInput readonly :filled="true" :model-value="key" />
            <i
              class="bi bi-x-lg cursor-pointer"
              @click="newOwnerKeys = newOwnerKeys.filter(k => k !== key)"
            ></i>
          </div>
        </template>
      </div>
    </div>

    <hr class="separator my-6" />

    <div>
      <AppSwitch
        v-model:checked="newAccountData.acceptStakingAwards"
        size="md"
        name="accept-staking-awards"
        label="Accept Staking Awards"
      />
    </div>

    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Staked Account Id</label>
        <AppInput
          v-model="newAccountData.stakedAccountId"
          :disabled="Boolean(newAccountData.stakedNodeId)"
          :filled="true"
          placeholder="Enter Account Id"
        />
      </div>
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Staked Node Id</label>
        <AppInput
          v-model="newAccountData.stakedNodeId"
          :disabled="
            Boolean(newAccountData.stakedAccountId && newAccountData.stakedAccountId.length > 0)
          "
          :filled="true"
          placeholder="Enter Node Id Number"
        />
      </div>
    </div>
    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Account Memo</label>
        <AppInput
          v-model="newAccountData.memo"
          :filled="true"
          maxlength="100"
          placeholder="Enter Memo"
        />
      </div>
    </div>

    <hr class="separator my-6" />

    <div>
      <AppSwitch
        v-model:checked="newAccountData.receiverSignatureRequired"
        size="md"
        name="receiver-signature"
        label="Receiver Signature Required"
      />
    </div>
    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Max Automatic Token Associations</label>
        <AppInput
          v-model="newAccountData.maxAutomaticTokenAssociations"
          :min="0"
          :max="5000"
          :filled="true"
          type="number"
          placeholder="Enter timestamp"
        />
      </div>
    </div>
  </form>

  <TransactionProcessor
    ref="transactionProcessor"
    :transaction-bytes="transaction?.toBytes() || null"
    :on-close-success-modal-click="() => $router.push({ name: 'accounts' })"
    :on-executed="() => (isExecuted = true)"
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
