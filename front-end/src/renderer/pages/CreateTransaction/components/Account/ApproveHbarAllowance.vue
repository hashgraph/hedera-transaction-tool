<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  Hbar,
  HbarUnit,
  Key,
  AccountAllowanceApproveTransaction,
  Transaction,
  KeyList,
} from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';
import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';

import { stringifyHbar, isAccountId, getTransactionFromBytes } from '@renderer/utils';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const payerData = useAccountId();
const ownerData = useAccountId();
const spenderData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(new Date());
const maxTransactionFee = ref<Hbar>(new Hbar(2));

const amount = ref<Hbar>(new Hbar(0));
const transactionMemo = ref('');
const keyStructureComponentKey = ref<Key | null>(null);

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const isKeyStructureModalShown = ref(false);

const isExecuted = ref(false);
const isSubmitted = ref(false);

/* Handlers */
const handleCreate = async e => {
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

    const requiredKey = new KeyList([payerData.key.value, ownerData.key.value]);
    await transactionProcessor.value?.process(requiredKey);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleLoadFromDraft = async () => {
  if (!router.currentRoute.value.query.draftId) return;

  const draft = await getDraft(router.currentRoute.value.query.draftId?.toString() || '');
  const draftTransaction = getTransactionFromBytes<AccountAllowanceApproveTransaction>(
    draft.transactionBytes,
  );

  if (draft) {
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

const handleSubmit = () => {
  isSubmitted.value = true;
  router.push({
    name: 'transactions',
    query: {
      tab: 'Ready for Execution',
    },
  });
};

/* Functions */
function createTransaction() {
  const transaction = new AccountAllowanceApproveTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionFee.value);

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  if (isAccountId(ownerData.accountId.value) && isAccountId(spenderData.accountId.value)) {
    transaction.approveHbarAllowance(
      ownerData.accountId.value,
      spenderData.accountId.value,
      amount.value,
    );
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

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <TransactionHeaderControls heading-text="Approve Hbar Allowance Transaction">
        <template #buttons>
          <SaveDraftButton
            :get-transaction-bytes="() => createTransaction().toBytes()"
            :is-executed="isExecuted || isSubmitted"
          />
          <AppButton
            color="primary"
            type="submit"
            data-testid="button-sign-and-submit-allowance"
            :disabled="
              !payerData.isValid.value ||
              !ownerData.isValid.value ||
              !spenderData.isValid.value ||
              amount.toBigNumber().isLessThan(0)
            "
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
              @update:model-value="v => (ownerData.accountId.value = v)"
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
              @update:model-value="v => (spenderData.accountId.value = v)"
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
      :on-close-success-modal-click="
        () => {
          validStart = new Date();
          maxTransactionFee = new Hbar(2);
          ownerData.accountId.value = '';
          spenderData.accountId.value = '';
          amount = new Hbar(0);
          transaction = null;
        }
      "
      :on-executed="() => (isExecuted = true)"
      :on-submitted="handleSubmit"
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
  </div>
</template>
