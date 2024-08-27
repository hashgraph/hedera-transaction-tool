<script setup lang="ts">
import { computed, ref, reactive, watch, onMounted } from 'vue';
import {
  AccountId,
  AccountUpdateTransaction,
  KeyList,
  Hbar,
  Transaction,
  Key,
} from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';
import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import useNetworkStore from '@renderer/stores/storeNetwork';
import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRoute, useRouter } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';

import {
  compareKeys,
  getTransactionFromBytes,
  getPropagationButtonLabel,
  isAccountId,
  formatAccountId,
} from '@renderer/utils';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import KeyField from '@renderer/components/KeyField.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionInfoControls from '@renderer/components/Transaction/TransactionInfoControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const transactionGroup = useTransactionGroupStore();

/* Composables */
const router = useRouter();
const route = useRoute();
const toast = useToast();
const payerData = useAccountId();
const accountData = useAccountId();

/* State */
const transactionProcessor = ref<InstanceType<typeof TransactionProcessor> | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(new Date());
const maxTransactionFee = ref<Hbar>(new Hbar(2));

const newAccountData = reactive<{
  receiverSignatureRequired: boolean;
  maxAutomaticTokenAssociations: number;
  stakedAccountId: string;
  stakedNodeId: number | null;
  acceptStakingRewards: boolean;
  memo: string;
}>({
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  stakedAccountId: '',
  stakedNodeId: null,
  acceptStakingRewards: false,
  memo: '',
});
const stakeType = ref<'Account' | 'Node' | 'None'>('None');
const newOwnerKey = ref<Key | null>(null);

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const isKeyStructureModalShown = ref(false);
const isExecuted = ref(false);
const isSubmitted = ref(false);

const transactionMemo = ref('');
const transactionName = ref('');
const transactionDescription = ref('');

/* Computed */
const transactionKey = computed(() => {
  const keyList: Key[] = [];

  payerData.key.value && keyList.push(payerData.key.value);
  accountData.key.value && keyList.push(accountData.key.value);
  newOwnerKey.value && keyList.push(newOwnerKey.value);

  return new KeyList(keyList);
});

/* Handlers */
const handleStakeTypeChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  const value = selectEl.value;

  if (value === 'None') {
    stakeType.value = 'None';
    newAccountData.stakedNodeId = null;
    newAccountData.stakedAccountId = '';
  } else if (value === 'Account' || value === 'Node') {
    stakeType.value = value;
  }
};

const handleNodeNumberChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  const value = selectEl.value;

  if (value === 'unselected') {
    newAccountData.stakedNodeId = null;
  } else if (!isNaN(Number(value))) {
    newAccountData.stakedNodeId = Number(value);
  }
};

const handleCreate = async e => {
  e.preventDefault();

  try {
    if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
      throw Error('Invalid Payer ID');
    }

    if (!isAccountId(accountData.accountId.value) || !accountData.key.value) {
      throw Error('Invalid Account ID');
    }

    transaction.value = createTransaction();
    await transactionProcessor.value?.process(
      {
        transactionKey: transactionKey.value,
        transactionBytes: transaction.value.toBytes(),
      },
      observers.value,
      approvers.value,
    );
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
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
      getTransactionFromBytes<AccountUpdateTransaction>(draftTransactionBytes);
    transaction.value = draftTransaction;

    accountData.accountId.value = draftTransaction.accountId?.toString() || '';

    newAccountData.receiverSignatureRequired = draftTransaction.receiverSignatureRequired || false;
    newAccountData.acceptStakingRewards = !draftTransaction.declineStakingRewards;

    newAccountData.maxAutomaticTokenAssociations =
      draftTransaction.maxAutomaticTokenAssociations?.toNumber() || 0;
    newAccountData.memo = draftTransaction.accountMemo || '';
    transactionMemo.value = draftTransaction.transactionMemo || '';

    if (draftTransaction.key) {
      newOwnerKey.value = draftTransaction.key;
    }

    if (draftTransaction.stakedAccountId?.toString() !== '0.0.0') {
      stakeType.value = 'Account';
      newAccountData.stakedAccountId = draftTransaction.stakedAccountId?.toString() || '';
    }

    if (draftTransaction.stakedNodeId && draftTransaction.stakedNodeId >= 0) {
      stakeType.value = 'Node';
      newAccountData.stakedNodeId = draftTransaction.stakedNodeId.toNumber() || '';
    }
  }
};

const handleSubmit = (id: number) => {
  isSubmitted.value = true;
  redirectToDetails(id);
};

const handleLocalStored = (id: string) => {
  redirectToDetails(id);
};

function handleAddToGroup() {
  if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
    throw Error('Invalid Payer ID');
  }

  if (!isAccountId(accountData.accountId.value) || !accountData.key.value) {
    throw Error('Invalid Account ID');
  }

  const transactionBytes = createTransaction().toBytes();
  const keys = new Array<string>();
  if (accountData.key.value instanceof KeyList) {
    for (const key of accountData.key.value.toArray()) {
      keys.push(key.toString());
    }
  }
  // TODO: handle single key?
  transactionGroup.addGroupItem({
    transactionBytes: transactionBytes,
    type: 'AccountUpdateTransaction',
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
  if (accountData.key.value instanceof KeyList) {
    for (const key of accountData.key.value.toArray()) {
      keys.push(key.toString());
    }
  }

  transactionGroup.editGroupItem({
    transactionBytes: transactionBytes,
    type: 'AccountUpdateTransaction',
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
  const oldData = accountData.accountInfo.value;

  const transaction = new AccountUpdateTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionFee.value);

  if (isAccountId(payerData.accountId.value) && !route.params.seq) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  isAccountId(accountData.accountId.value) && transaction.setAccountId(accountData.accountId.value);

  if (oldData?.receiverSignatureRequired !== newAccountData.receiverSignatureRequired) {
    transaction.setReceiverSignatureRequired(newAccountData.receiverSignatureRequired);
  }

  if (oldData?.declineReward !== !newAccountData.acceptStakingRewards) {
    transaction.setDeclineStakingReward(!newAccountData.acceptStakingRewards);
  }

  if (oldData?.maxAutomaticTokenAssociations !== newAccountData.maxAutomaticTokenAssociations) {
    transaction.setMaxAutomaticTokenAssociations(
      Number(newAccountData.maxAutomaticTokenAssociations),
    );
  }

  if (oldData?.memo !== newAccountData.memo) {
    transaction.setAccountMemo(newAccountData.memo || '');
  }

  if (newOwnerKey.value && accountData.key.value) {
    !compareKeys(newOwnerKey.value, accountData.key.value) && transaction.setKey(newOwnerKey.value);
  } else if (newOwnerKey.value) {
    transaction.setKey(newOwnerKey.value);
  }

  if (stakeType.value === 'None') {
    oldData?.stakedAccountId && transaction.clearStakedAccountId();
    oldData?.stakedNodeId !== null && transaction.clearStakedNodeId();
  } else if (stakeType.value === 'Account') {
    if (
      !isAccountId(newAccountData.stakedAccountId) ||
      newAccountData.stakedAccountId === '0.0.0'
    ) {
      transaction.clearStakedAccountId();
    } else if (
      isAccountId(newAccountData.stakedAccountId) &&
      oldData?.stakedAccountId?.toString() !== newAccountData.stakedAccountId
    ) {
      transaction.setStakedAccountId(newAccountData.stakedAccountId);
    }
  } else if (stakeType.value === 'Node') {
    if (newAccountData.stakedNodeId === null) {
      transaction.clearStakedNodeId();
    } else if (oldData?.stakedNodeId !== newAccountData.stakedNodeId) {
      transaction.setStakedNodeId(newAccountData.stakedNodeId);
    }
  }

  if (transactionMemo.value.length > 0 && transactionMemo.value.length <= MEMO_MAX_LENGTH) {
    transaction.setTransactionMemo(transactionMemo.value);
  }

  return transaction;
}

async function redirectToDetails(id: string | number) {
  router.push({
    name: 'transactionDetails',
    params: { id },
  });
}

/* Hooks */
onMounted(async () => {
  if (router.currentRoute.value.query.draftId || route.query.groupIndex) {
    await handleLoadFromDraft();
  } else if (router.currentRoute.value.query.accountId) {
    accountData.accountId.value = router.currentRoute.value.query.accountId.toString();
  }
});

/* Watchers */
watch(accountData.accountInfo, accountInfo => {
  if (!accountInfo) {
    newAccountData.receiverSignatureRequired = false;
    newAccountData.maxAutomaticTokenAssociations = 0;
    newAccountData.stakedAccountId = '';
    newAccountData.stakedNodeId = null;
    newAccountData.acceptStakingRewards = false;
    newAccountData.memo = '';
    newOwnerKey.value = null;
  } else if (!router.currentRoute.value.query.draftId) {
    newAccountData.receiverSignatureRequired = accountInfo.receiverSignatureRequired;
    newAccountData.maxAutomaticTokenAssociations = accountInfo.maxAutomaticTokenAssociations || 0;
    newAccountData.stakedAccountId = accountInfo.stakedAccountId?.toString() || '';
    newAccountData.stakedNodeId = accountInfo.stakedNodeId;
    stakeType.value = accountInfo.stakedAccountId
      ? 'Account'
      : accountInfo.stakedNodeId !== null
        ? 'Node'
        : 'None';
    newAccountData.acceptStakingRewards = !accountInfo.declineReward;
    newAccountData.memo = accountInfo.memo || '';
    newOwnerKey.value = accountInfo.key;
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
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <TransactionHeaderControls heading-text="Update Account Transaction">
        <template #buttons>
          <div
            v-if="!($route.query.group === 'true')"
            class="flex-centered justify-content-end flex-wrap gap-3 mt-3"
          >
            <SaveDraftButton
              :get-transaction-bytes="() => createTransaction().toBytes()"
              :is-executed="isExecuted || isSubmitted"
            />
            <AppButton
              color="primary"
              type="submit"
              data-testid="button-sign-and-submit-update"
              :disabled="
                !accountData.accountId.value ||
                !payerData.isValid.value ||
                !accountData.isValid.value ||
                (stakeType === 'Account' && !isAccountId(newAccountData.stakedAccountId)) ||
                (stakeType === 'Node' && newAccountData.stakedNodeId === null)
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

        <TransactionIdControls
          v-model:payer-id="payerData.accountId.value"
          v-model:valid-start="validStart"
          v-model:max-transaction-fee="maxTransactionFee as Hbar"
          class="mt-6"
        />

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <label class="form-label">Transaction Memo</label>
            <AppInput
              v-model="transactionMemo"
              data-testid="input-transaction-memo"
              :filled="true"
              maxlength="100"
              placeholder="Enter Transaction Memo"
            />
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="row">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Account ID <span class="text-danger">*</span></label>
            <AppInput
              :model-value="accountData.accountIdFormatted.value"
              @update:model-value="v => (accountData.accountId.value = formatAccountId(v))"
              :filled="true"
              data-testid="input-account-id-for-update"
              placeholder="Enter Account ID"
            />
            <div v-if="accountData.isValid.value" data-testid="div-account-info-fetched"></div>
          </div>

          <div class="form-group mt-6" :class="[columnClass]">
            <AppButton
              v-if="accountData.key.value"
              class="text-nowrap"
              color="secondary"
              type="button"
              @click="isKeyStructureModalShown = true"
              >Show Key</AppButton
            >
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <KeyField :model-key="newOwnerKey" @update:model-key="key => (newOwnerKey = key)" />
          </div>
        </div>

        <div class="mt-6">
          <AppSwitch
            v-model:checked="newAccountData.acceptStakingRewards"
            size="md"
            name="accept-staking-rewards"
            data-testid="switch-accept-staking-rewards"
            label="Accept Staking Rewards"
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
              <label class="form-label">Account ID <span class="text-danger">*</span></label>
              <AppInput
                :model-value="newAccountData.stakedAccountId"
                @update:model-value="v => (newAccountData.stakedAccountId = formatAccountId(v))"
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
                <option value="unselected" :selected="!stakeType" default>No node selected</option>
                <template v-for="nodeNumber in network.nodeNumbers" :key="nodeNumber">
                  <option
                    :value="nodeNumber"
                    :selected="newAccountData.stakedNodeId === nodeNumber"
                  >
                    {{ nodeNumber }}
                  </option>
                </template>
              </select>
            </template>
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Account Memo</label>
            <AppInput
              v-model="newAccountData.memo"
              :filled="true"
              maxlength="100"
              data-testid="input-memo-update"
              placeholder="Enter Memo"
            />
          </div>
        </div>

        <div class="mt-6">
          <AppSwitch
            v-model:checked="newAccountData.receiverSignatureRequired"
            size="md"
            name="receiver-signature"
            data-testid="switch-receiver-sig-required-for-update"
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
              data-testid="input-max-auto-token-associations"
              placeholder="Enter Max Token Associations"
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
      :transaction-bytes="transaction?.toBytes() || null"
      :observers="observers"
      :approvers="approvers"
      :on-executed="() => (isExecuted = true)"
      :on-submitted="handleSubmit"
      :on-local-stored="handleLocalStored"
    >
    </TransactionProcessor>

    <KeyStructureModal
      v-if="accountData.isValid.value"
      v-model:show="isKeyStructureModalShown"
      :account-key="accountData.key.value"
    />
  </div>
</template>
