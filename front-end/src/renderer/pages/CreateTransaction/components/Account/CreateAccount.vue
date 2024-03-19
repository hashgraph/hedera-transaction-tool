<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import {
  AccountId,
  AccountCreateTransaction,
  Hbar,
  Transaction,
  TransactionReceipt,
  Key,
  HbarUnit,
} from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';

import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

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

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import KeyField from '@renderer/components/KeyField.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const route = useRoute();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(getDateTimeLocalInputValue(new Date()));
const maxTransactionFee = ref<Hbar>(new Hbar(2));

const accountData = reactive<{
  accountId: string;
  receiverSignatureRequired: boolean;
  maxAutomaticTokenAssociations: 0;
  initialBalance: Hbar;
  stakedAccountId: string;
  stakedNodeId: number | null;
  acceptStakingRewards: boolean;
  memo: string;
}>({
  accountId: '',
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  initialBalance: new Hbar(0),
  stakedAccountId: '',
  stakedNodeId: null,
  acceptStakingRewards: true,
  memo: '',
});
const stakeType = ref<'Account' | 'Node' | 'None'>('None');
const ownerKey = ref<Key | null>(null);
const isExecuted = ref(false);
const nickname = ref('');
const transactionMemo = ref('');

/* Handlers */
const handleStakeTypeChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  const value = selectEl.value;

  if (value === 'None') {
    stakeType.value = 'None';
    accountData.stakedNodeId = null;
    accountData.stakedAccountId = '';
  } else if (value === 'Account' || value === 'Node') {
    stakeType.value = value;
  }
};

const handleNodeNumberChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  const value = selectEl.value;

  if (value === 'unselected') {
    accountData.stakedNodeId = null;
  } else if (!isNaN(Number(value))) {
    accountData.stakedNodeId = Number(value);
  }
};

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
    accountData.initialBalance = draftTransaction.initialBalance || new Hbar(0);
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
  ownerKey.value = key;
};

/* Functions */
function createTransaction() {
  const transaction = new AccountCreateTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionFee.value)
    .setReceiverSignatureRequired(accountData.receiverSignatureRequired)
    .setDeclineStakingReward(!accountData.acceptStakingRewards)
    .setInitialBalance(Hbar.fromString(accountData.initialBalance.toString() || '0'))
    .setMaxAutomaticTokenAssociations(Number(accountData.maxAutomaticTokenAssociations))
    .setAccountMemo(accountData.memo);

  if (ownerKey.value) {
    transaction.setKey(ownerKey.value);
  }

  if (stakeType.value === 'Account' && isAccountId(accountData.stakedAccountId)) {
    transaction.setStakedAccountId(AccountId.fromString(accountData.stakedAccountId));
  } else if (stakeType.value === 'Node' && accountData.stakedNodeId !== null) {
    transaction.setStakedNodeId(Number(accountData.stakedNodeId));
  }

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  if (transactionMemo.value.length > 0 && transactionMemo.value.length <= MEMO_MAX_LENGTH) {
    transaction.setTransactionMemo(transactionMemo.value);
  }

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
  if (isValid && payerData.key.value && !ownerKey.value) {
    ownerKey.value = payerData.key.value;
  }
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <TransactionHeaderControls heading-text="Create Account Transaction">
        <template #buttons>
          <SaveDraftButton
            :get-transaction-bytes="() => createTransaction().toBytes()"
            :is-executed="isExecuted"
          />
          <AppButton
            color="primary"
            type="submit"
            :disabled="!ownerKey || !payerData.isValid.value"
          >
            <span class="bi bi-send"></span>
            Sign & Submit</AppButton
          >
        </template>
      </TransactionHeaderControls>

      <hr class="separator my-5" />

      <TransactionIdControls
        v-model:payer-id="payerData.accountId.value"
        v-model:valid-start="validStart"
        v-model:max-transaction-fee="maxTransactionFee as Hbar"
      />

      <hr class="separator my-5" />

      <div class="fill-remaining">
        <div class="row">
          <div class="form-group col-8 col-xxxl-6">
            <KeyField :model-key="ownerKey" @update:model-key="handleOwnerKeyUpdate" is-required />
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <label class="form-label">Transaction Memo</label>
            <AppInput
              v-model="transactionMemo"
              :filled="true"
              maxlength="100"
              placeholder="Enter Transaction Memo"
            />
          </div>
        </div>

        <div class="form-group mt-6">
          <AppSwitch
            v-model:checked="accountData.acceptStakingRewards"
            size="md"
            name="accept-staking-awards"
            label="Accept Staking Awards"
          />
        </div>

        <div class="row mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Staking</label>
            <select class="form-select is-fill" name="stake_type" @change="handleStakeTypeChange">
              <template v-for="stakeEntity in ['None', 'Account', 'Node']" :key="stakeEntity">
                <option :value="stakeEntity" :selected="stakeType === stakeEntity">
                  {{ stakeEntity }}
                </option>
              </template>
            </select>
          </div>
          <div v-if="stakeType" class="form-group" :class="[columnClass]">
            <template v-if="stakeType === 'Account'">
              <label class="form-label">Account ID</label>
              <AppInput
                v-model="accountData.stakedAccountId"
                :filled="true"
                placeholder="Enter Account ID"
              />
            </template>
            <template v-else-if="stakeType === 'Node'">
              <label class="form-label">Node Number</label>
              <select
                class="form-select is-fill"
                name="node_number"
                @change="handleNodeNumberChange"
              >
                <option value="unselected" :selected="!stakeType" default>No node selected</option>
                <template v-for="nodeNumber in network.nodeNumbers" :key="nodeNumber">
                  <option :value="nodeNumber" :selected="accountData.stakedNodeId === nodeNumber">
                    {{ nodeNumber }}
                  </option>
                </template>
              </select>
            </template>
          </div>
        </div>

        <div class="mt-6">
          <AppSwitch
            v-model:checked="accountData.receiverSignatureRequired"
            size="md"
            name="receiver-signature"
            label="Receiver Signature Required"
          />
        </div>

        <div class="row mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Initial Balance {{ HbarUnit.Hbar._symbol }}</label>
            <AppHbarInput
              v-model:model-value="accountData.initialBalance as Hbar"
              placeholder="Enter Amount"
              :filled="true"
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

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <label class="form-label">Account Memo</label>
            <AppInput
              v-model="accountData.memo"
              :filled="true"
              maxlength="100"
              placeholder="Enter Account Memo"
            />
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Nickname</label>
            <div class="">
              <AppInput v-model="nickname" :filled="true" placeholder="Enter Nickname" />
            </div>
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
  </div>
</template>
