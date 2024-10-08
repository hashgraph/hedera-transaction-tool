<script setup lang="ts">
import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import { computed, onMounted, ref } from 'vue';
import {
  Hbar,
  HbarUnit,
  Key,
  AccountAllowanceApproveTransaction,
  Transaction,
  KeyList,
} from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useToast } from 'vue-toast-notification';
import { useRoute, useRouter } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createApproveAllowanceTransaction } from '@renderer/utils/sdk/createTransactions';
import { getDraft } from '@renderer/services/transactionDraftsService';

import {
  stringifyHbar,
  isAccountId,
  getTransactionFromBytes,
  getPropagationButtonLabel,
  formatAccountId,
  redirectToDetails,
} from '@renderer/utils';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionInfoControls from '@renderer/components/Transaction/TransactionInfoControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';
import AddToGroupModal from '@renderer/components/AddToGroupModal.vue';

/* Stores */
const user = useUserStore();
const transactionGroup = useTransactionGroupStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const route = useRoute();
const payerData = useAccountId();
const ownerData = useAccountId();
const spenderData = useAccountId();

/* State */
const transactionProcessor = ref<InstanceType<typeof TransactionProcessor> | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(new Date());
const maxTransactionFee = ref<Hbar>(new Hbar(2));

const amount = ref<Hbar>(new Hbar(0));
const keyStructureComponentKey = ref<Key | null>(null);

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
  ownerData.key.value && keyList.push(ownerData.key.value);

  return new KeyList(keyList);
});

/* Handlers */
const handleCreate = async (e: Event) => {
  e.preventDefault();

  try {
    if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
      throw Error('Invalid Payer ID');
    }

    if (!isAccountId(ownerData.accountId.value) || !ownerData.key.value) {
      throw Error('Invalid Owner ID');
    }

    if (!isAccountId(spenderData.accountId.value)) {
      throw Error('Invalid Spender ID');
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
      getTransactionFromBytes<AccountAllowanceApproveTransaction>(draftTransactionBytes);
    transaction.value = draftTransaction;

    if (draftTransaction.hbarApprovals.length > 0) {
      const hbarApproval = draftTransaction.hbarApprovals[0];

      ownerData.accountId.value = hbarApproval.ownerAccountId?.toString() || '';
      spenderData.accountId.value = hbarApproval.spenderAccountId?.toString() || '';
      amount.value = hbarApproval.amount || new Hbar(0);
    }

    transactionMemo.value = draftTransaction.transactionMemo || '';
  }
};

const handleLocalStored = (id: string) => {
  toast.success('Approve Allowance Transaction Executed', { position: 'bottom-right' });
  redirectToDetails(router, id);
};

const handleSubmit = (id: number) => {
  isSubmitted.value = true;
  redirectToDetails(router, id);
};

function handleAddToGroup() {
  if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
    throw Error('Invalid Payer ID');
  }

  if (!isAccountId(ownerData.accountId.value) || !ownerData.key.value) {
    throw Error('Invalid Owner ID');
  }

  if (!isAccountId(spenderData.accountId.value)) {
    throw Error('Invalid Spender ID');
  }
  const transactionBytes = createTransaction().toBytes();
  const keys = new Array<string>();
  if (ownerData.key.value instanceof KeyList) {
    for (const key of ownerData.key.value.toArray()) {
      keys.push(key.toString());
    }
  }

  transactionGroup.addGroupItem({
    transactionBytes: transactionBytes,
    type: 'AccountAllowanceApproveTransaction',
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
  if (ownerData.key.value instanceof KeyList) {
    for (const key of ownerData.key.value.toArray()) {
      keys.push(key.toString());
    }
  }

  transactionGroup.editGroupItem({
    transactionBytes: transactionBytes,
    type: 'AccountAllowanceApproveTransaction',
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
  return createApproveAllowanceTransaction({
    payerId: payerData.accountId.value,
    validStart: validStart.value,
    maxTransactionFee: maxTransactionFee.value as Hbar,
    ownerAccountId: ownerData.accountId.value,
    spenderAccountId: spenderData.accountId.value,
    amount: amount.value as Hbar,
    transactionMemo: transactionMemo.value,
  });
}

/* Hooks */
onMounted(async () => {
  await handleLoadFromDraft();
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <TransactionHeaderControls heading-text="Approve Hbar Allowance Transaction">
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
              data-testid="button-sign-and-submit-allowance"
              :disabled="!ownerData.key || !payerData.isValid.value"
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
              :filled="true"
              maxlength="100"
              data-testid="input-transaction-memo-for-approve-allowance"
              placeholder="Enter Transaction Memo"
            />
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="row align-items-end">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Owner ID <span class="text-danger">*</span></label>
            <label v-if="ownerData.isValid.value" class="form-label d-block text-secondary"
              >Balance:
              {{
                stringifyHbar((ownerData.accountInfo.value?.balance as Hbar) || new Hbar(0))
              }}</label
            >

            <AppInput
              :model-value="ownerData.accountIdFormatted.value"
              @update:model-value="v => (ownerData.accountId.value = formatAccountId(v))"
              :filled="true"
              data-testid="input-owner-account"
              placeholder="Enter Owner ID"
            />
          </div>

          <div class="form-group" :class="[columnClass]" v-if="ownerData.key.value">
            <AppButton
              color="secondary"
              type="button"
              @click="
                isKeyStructureModalShown = true;
                keyStructureComponentKey = ownerData.key.value;
              "
              >Show Key</AppButton
            >
          </div>
        </div>

        <div class="row align-items-end mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Spender ID <span class="text-danger">*</span></label>
            <label v-if="spenderData.isValid.value" class="form-label d-block text-secondary"
              >Allowance:
              {{ stringifyHbar(ownerData.getSpenderAllowance(spenderData.accountId.value)) }}</label
            >
            <AppInput
              :model-value="spenderData.accountIdFormatted.value"
              @update:model-value="v => (spenderData.accountId.value = formatAccountId(v))"
              :filled="true"
              data-testid="input-spender-account"
              placeholder="Enter Spender ID"
            />
          </div>
          <div class="form-group" :class="[columnClass]" v-if="spenderData.key.value">
            <AppButton
              color="secondary"
              type="button"
              @click="
                isKeyStructureModalShown = true;
                keyStructureComponentKey = spenderData.key.value;
              "
              >Show Key</AppButton
            >
          </div>
        </div>

        <div class="row mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label"
              >Amount {{ HbarUnit.Hbar._symbol }} <span class="text-danger">*</span></label
            >
            <AppHbarInput
              v-model:model-value="amount as Hbar"
              data-testid="input-allowance-amount"
              placeholder="Enter Amount"
              :filled="true"
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
      <template #successHeading>Allowance Approved Successfully</template>
      <template #successContent>
        <p class="text-small d-flex justify-content-between align-items mt-2">
          <span class="text-bold text-secondary">Owner Account ID:</span>
          <span>{{ ownerData.accountIdFormatted.value }}</span>
        </p>
        <p class="text-small d-flex justify-content-between align-items mt-2">
          <span class="text-bold text-secondary">Spender Account ID:</span>
          <span>{{ spenderData.accountIdFormatted.value }}</span>
        </p>
      </template>
    </TransactionProcessor>

    <KeyStructureModal
      v-model:show="isKeyStructureModalShown"
      :account-key="keyStructureComponentKey"
    />
    <AddToGroupModal @addToGroup="handleAddToGroup" />
  </div>
</template>
