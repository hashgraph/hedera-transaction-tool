<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import {
  AccountId,
  AccountCreateTransaction,
  Hbar,
  Transaction,
  TransactionReceipt,
  Key,
  HbarUnit,
  KeyList,
  TransactionResponse,
} from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';
import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useRoute, useRouter } from 'vue-router';

import { add } from '@renderer/services/accountsService';
import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';

import { isAccountId, formatAccountId } from '@renderer/utils';
import {
  getEntityIdFromTransactionReceipt,
  getTransactionFromBytes,
  getPropagationButtonLabel,
} from '@renderer/utils/transactions';
import { isUserLoggedIn, isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import KeyField from '@renderer/components/KeyField.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionInfoControls from '@renderer/components/Transaction/TransactionInfoControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const transactionGroup = useTransactionGroupStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const route = useRoute();
const payerData = useAccountId();

/* State */
const transactionProcessor = ref<InstanceType<typeof TransactionProcessor> | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(new Date());
const maxTransactionFee = ref<Hbar>(new Hbar(2));

const accountData = reactive<{
  accountId: string;
  receiverSignatureRequired: boolean;
  maxAutomaticTokenAssociations: 0;
  stakedAccountId: string;
  stakedNodeId: number | null;
  acceptStakingRewards: boolean;
  memo: string;
}>({
  accountId: '',
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  stakedAccountId: '',
  stakedNodeId: null,
  acceptStakingRewards: true,
  memo: '',
});
const initialBalance = ref<Hbar>(new Hbar(0));
const stakeType = ref<'Account' | 'Node' | 'None'>('None');
const ownerKey = ref<Key | null>(null);
const isExecuted = ref(false);
const isSubmitted = ref(false);

const nickname = ref('');

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const transactionName = ref('');
const transactionDescription = ref('');
const transactionMemo = ref('');

/* Computed */
const transactionKey = computed(() => {
  const keyList: Key[] = [];
  payerData.key.value && keyList.push(payerData.key.value);

  return new KeyList(keyList);
});

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
    await transactionProcessor.value?.process(
      {
        transactionKey: transactionKey.value,
        transactionBytes: transaction.value.toBytes(),
        name: transactionName.value,
        description: transactionDescription.value,
      },
      observers.value,
      approvers.value,
    );
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleExecuted = async (
  success: boolean,
  _response: TransactionResponse | null,
  receipt: TransactionReceipt | null,
) => {
  isExecuted.value = true;

  if (success && receipt) {
    if (!isUserLoggedIn(user.personal)) {
      throw new Error('User is not logged in');
    }

    toast.success(`Account Create Transaction Executed`, { position: 'bottom-right' });

    const accountId = getEntityIdFromTransactionReceipt(receipt, 'accountId');
    await add(user.personal.id, accountId, network.network, nickname.value);
    toast.success(`Account ${accountId} linked`, { position: 'bottom-right' });
  }
};

const handleLoadFromDraft = async () => {
  if (!router.currentRoute.value.query.draftId && !route.query.groupIndex) return;
  let draftTransactionBytes: string | null = null;
  if (!route.query.group) {
    const draft = await getDraft(router.currentRoute.value.query.draftId?.toString() || '');
    draftTransactionBytes = draft.transactionBytes;
  } else if (route.query.groupIndex) {
    draftTransactionBytes =
      transactionGroup.groupItems[Number(route.query.groupIndex)].transactionBytes.toString();
  }

  if (draftTransactionBytes) {
    const draftTransaction =
      getTransactionFromBytes<AccountCreateTransaction>(draftTransactionBytes);
    transaction.value = draftTransaction;

    accountData.receiverSignatureRequired = draftTransaction.receiverSignatureRequired;
    accountData.maxAutomaticTokenAssociations =
      draftTransaction.maxAutomaticTokenAssociations.toNumber();
    initialBalance.value = draftTransaction.initialBalance || new Hbar(0);

    if (draftTransaction.stakedAccountId) {
      stakeType.value = 'Account';
      accountData.stakedAccountId = draftTransaction.stakedAccountId?.toString() || '';
    } else if (draftTransaction.stakedNodeId) {
      stakeType.value = 'Node';
      accountData.stakedNodeId = draftTransaction.stakedNodeId.toNumber();
    }

    accountData.acceptStakingRewards = !draftTransaction.declineStakingRewards;
    accountData.memo = draftTransaction.accountMemo || '';

    if (draftTransaction.key) {
      ownerKey.value = draftTransaction.key;
    }

    transactionMemo.value = draftTransaction.transactionMemo || '';
  }
};

const handleOwnerKeyUpdate = key => {
  ownerKey.value = key;
};

const handleSubmit = (id: number) => {
  isSubmitted.value = true;
  redirectToDetails(id);
};

function handleAddToGroup() {
  if (!isAccountId(payerData.accountId.value)) {
    throw new Error('Invalid Payer ID');
  }

  if (!ownerKey.value) {
    throw new Error('Owner key is required');
  }
  const transactionBytes = createTransaction().toBytes();
  const keys = new Array<string>();
  if (ownerKey.value instanceof KeyList) {
    for (const key of ownerKey.value.toArray()) {
      keys.push(key.toString());
    }
  }
  // TODO: handle single key?
  transactionGroup.addGroupItem({
    transactionBytes: transactionBytes,
    type: 'AccountCreateTransaction',
    accountId: '',
    seq: transactionGroup.groupItems.length.toString(),
    keyList: keys,
    observers: observers.value,
    approvers: approvers.value,
    payerAccountId: payerData.accountId.value,
    validStart: validStart.value,
  });
  router.push({ name: 'createTransactionGroup' });
}

function handleEditGroupItem() {
  const transactionBytes = createTransaction().toBytes();
  const keys = new Array<string>();
  if (ownerKey.value instanceof KeyList) {
    for (const key of ownerKey.value.toArray()) {
      keys.push(key.toString());
    }
  }

  transactionGroup.editGroupItem({
    transactionBytes: transactionBytes,
    type: 'AccountCreateTransaction',
    accountId: '',
    seq: route.params.seq[0],
    groupId: transactionGroup.groupItems[Number(route.query.groupIndex)].groupId,
    keyList: keys,
    observers: observers.value,
    approvers: approvers.value,
    payerAccountId: payerData.accountId.value,
    validStart: validStart.value,
  });
  router.push({ name: 'createTransactionGroup' });
}

/* Functions */
function createTransaction() {
  const transaction = new AccountCreateTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionFee.value)
    .setReceiverSignatureRequired(accountData.receiverSignatureRequired)
    .setDeclineStakingReward(!accountData.acceptStakingRewards)
    .setInitialBalance(Hbar.fromString(initialBalance.value.toString() || '0'))
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

  if (isAccountId(payerData.accountId.value) && !route.params.seq) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  if (transactionMemo.value.length > 0 && transactionMemo.value.length <= MEMO_MAX_LENGTH) {
    transaction.setTransactionMemo(transactionMemo.value);
  }

  return transaction;
}

const redirectToDetails = async (id: string | number) => {
  router.push({
    name: 'transactionDetails',
    params: { id },
  });
};

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
  if (
    isValid &&
    payerData.key.value &&
    !ownerKey.value &&
    !router.currentRoute.value.query.draftId
  ) {
    ownerKey.value = payerData.key.value;
  }
});

watch([initialBalance, payerData.accountInfo], async ([balance, accountInfo]) => {
  if (
    accountInfo &&
    balance?.toBigNumber().isGreaterThan(accountInfo.balance?.toBigNumber() || 0)
  ) {
    await nextTick();
    initialBalance.value = new Hbar(0);
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
          <div
            v-if="!($route.query.group === 'true')"
            class="flex-centered justify-content-end flex-wrap gap-3 mt-3"
          >
            <SaveDraftButton
              :get-transaction-bytes="() => createTransaction().toBytes()"
              :description="transactionDescription"
              :is-executed="isExecuted || isSubmitted"
            />
            <AppButton
              color="primary"
              type="submit"
              data-testid="button-sign-and-submit"
              :disabled="
                !ownerKey ||
                !payerData.isValid.value ||
                (stakeType === 'Account' && !isAccountId(accountData.stakedAccountId)) ||
                (stakeType === 'Node' && accountData.stakedNodeId === null)
              "
            >
              <span class="bi bi-send"></span>
              {{
                getPropagationButtonLabel(
                  transactionKey,
                  user.keyPairs,
                  Boolean(user.selectedOrganization),
                )
              }}</AppButton
            >
          </div>
          <div v-else>
            <AppButton
              v-if="$route.params.seq"
              color="primary"
              type="button"
              @click="handleEditGroupItem"
            >
              <span class="bi bi-plus-lg" />
              Edit Group Item
            </AppButton>
            <AppButton v-else color="primary" type="button" @click="handleAddToGroup">
              <span class="bi bi-plus-lg" />
              Add to Group
            </AppButton>
          </div>
        </template>
      </TransactionHeaderControls>

      <hr class="separator my-5" />

      <div class="fill-remaining">
        <TransactionInfoControls
          v-model:name="transactionName"
          v-model:description="transactionDescription"
        />

        <div class="row my-6">
          <div v-if="!user.selectedOrganization" class="form-group" :class="[columnClass]">
            <label class="form-label">Nickname</label>
            <div class="">
              <AppInput
                v-model="nickname"
                :filled="true"
                data-testid="input-nickname"
                placeholder="Enter Account Nickname"
              />
            </div>
          </div>
        </div>

        <TransactionIdControls
          v-model:payer-id="payerData.accountId.value"
          v-model:valid-start="validStart"
          v-model:max-transaction-fee="maxTransactionFee as Hbar"
        />

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <label class="form-label">Transaction Memo</label>
            <AppInput
              data-testid="input-transaction-memo"
              v-model="transactionMemo"
              :filled="true"
              maxlength="100"
              placeholder="Enter Transaction Memo"
            />
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="row">
          <div class="form-group col-8 col-xxxl-6">
            <KeyField :model-key="ownerKey" @update:model-key="handleOwnerKeyUpdate" is-required />
          </div>
        </div>

        <div class="form-group mt-6">
          <AppSwitch
            v-model:checked="accountData.acceptStakingRewards"
            data-testid="switch-accept-staking-rewards"
            size="md"
            name="accept-staking-rewards"
            label="Accept Staking Rewards"
          />
        </div>

        <div class="row mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Staking</label>
            <select
              class="form-select is-fill"
              data-testid="dropdown-staking-account"
              name="stake_type"
              @change="handleStakeTypeChange"
            >
              <template v-for="stakeEntity in ['None', 'Account', 'Node']" :key="stakeEntity">
                <option
                  :value="stakeEntity"
                  :selected="stakeType === stakeEntity"
                  :data-testid="'option-' + stakeEntity.toLowerCase()"
                >
                  {{ stakeEntity }}
                </option>
              </template>
            </select>
          </div>
          <div v-if="stakeType" class="form-group" :class="[columnClass]">
            <template v-if="stakeType === 'Account'">
              <label class="form-label">Account ID <span class="text-danger">*</span></label>
              <AppInput
                data-testid="input-stake-accountid"
                :model-value="accountData.stakedAccountId"
                @update:model-value="v => (accountData.stakedAccountId = formatAccountId(v))"
                :filled="true"
                placeholder="Enter Account ID"
              />
            </template>
            <template v-else-if="stakeType === 'Node'">
              <label class="form-label">Node Number <span class="text-danger">*</span></label>
              <select
                class="form-select is-fill"
                name="node_number"
                @change="handleNodeNumberChange"
              >
                <option
                  value="unselected"
                  :selected="!stakeType"
                  default
                  data-testid="option-no-node-selected"
                >
                  No node selected
                </option>
                <template v-for="nodeNumber in network.nodeNumbers" :key="nodeNumber">
                  <option
                    :value="nodeNumber"
                    :selected="accountData.stakedNodeId === nodeNumber"
                    :data-testid="'option-node-' + nodeNumber"
                  >
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
            data-testid="switch-receiver-sig-required"
            size="md"
            name="receiver-signature"
            label="Receiver Signature Required"
          />
        </div>

        <div class="row mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Initial Balance {{ HbarUnit.Hbar._symbol }}</label>
            <AppHbarInput
              data-testid="input-initial-balance-amount"
              v-model:model-value="initialBalance as Hbar"
              placeholder="Enter Amount"
              :filled="true"
            />
          </div>
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Max Automatic Token Associations</label>
            <AppInput
              v-model="accountData.maxAutomaticTokenAssociations"
              data-testid="input-max-auto-associations"
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
              data-testid="input-account-memo"
              v-model="accountData.memo"
              :filled="true"
              maxlength="100"
              placeholder="Enter Account Memo"
            />
          </div>
        </div>

        <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
          <div class="form-group col-12 col-xxxl-8">
            <label class="form-label">Observers</label>
            <UsersGroup v-model:userIds="observers" :addable="true" :editable="true" />
          </div>
        </div>

        <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="row mt-6">
          <div class="form-group col-12 col-xxxl-8">
            <label class="form-label">Approvers</label>
            <ApproversList v-model:approvers="approvers" :editable="true" />
          </div>
        </div>
      </div>
    </form>

    <TransactionProcessor
      ref="transactionProcessor"
      :on-executed="handleExecuted"
      :on-submitted="handleSubmit"
      :on-local-stored="redirectToDetails"
    />
  </div>
</template>
