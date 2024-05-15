<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Hbar, AccountDeleteTransaction, Key, Transaction, KeyList } from '@hashgraph/sdk';

import { MEMO_MAX_LENGTH } from '@main/shared/constants';
import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';

import { createTransactionId } from '@renderer/services/transactionService';
import { getDraft } from '@renderer/services/transactionDraftsService';
import { remove } from '@renderer/services/accountsService';

import { getTransactionFromBytes, isAccountId } from '@renderer/utils';
import { isUserLoggedIn, isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const toast = useToast();

const payerData = useAccountId();
const accountData = useAccountId();
const transferAccountData = useAccountId();

/* State */
const transactionProcessor = ref<typeof TransactionProcessor | null>(null);

const transaction = ref<Transaction | null>(null);
const validStart = ref(new Date());
const maxTransactionFee = ref<Hbar>(new Hbar(2));
const transactionMemo = ref('');

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const selectedKey = ref<Key | null>();
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

    if (!isAccountId(accountData.accountId.value) || !accountData.key.value) {
      throw Error('Invalid Account ID');
    }

    if (!isAccountId(transferAccountData.accountId.value) || !transferAccountData.key.value) {
      throw Error('Invalid Transfer Account ID');
    }

    transaction.value = createTransaction();

    const requiredKey = new KeyList(
      transferAccountData.accountInfo.value?.receiverSignatureRequired &&
      transferAccountData.key.value
        ? [payerData.key.value, accountData.key.value, transferAccountData.key.value]
        : [payerData.key.value, accountData.key.value],
    );
    await transactionProcessor.value?.process(requiredKey);
  } catch (err: any) {
    toast.error(err.message || 'Failed to create transaction', { position: 'bottom-right' });
  }
};

const handleLoadFromDraft = async () => {
  if (!router.currentRoute.value.query.draftId) return;

  const draft = await getDraft(router.currentRoute.value.query.draftId?.toString() || '');
  const draftTransaction = getTransactionFromBytes<AccountDeleteTransaction>(
    draft.transactionBytes,
  );

  if (draft) {
    transaction.value = draftTransaction;

    accountData.accountId.value = draftTransaction.accountId?.toString() || '';
    transferAccountData.accountId.value = draftTransaction.transferAccountId?.toString() || '';
    transactionMemo.value = draftTransaction.transactionMemo || '';
  }
};

const handleExecuted = async () => {
  isExecuted.value = true;

  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  try {
    await remove(user.personal.id, accountData.accountId.value);
  } catch {
    /* Ignore if not found or error */
  }

  // Counter mirror node delay
  setTimeout(async () => {
    await user.refetchKeys();
  }, 5000);
};

const handleSubmit = async () => {
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
  const transaction = new AccountDeleteTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionFee.value);

  if (isAccountId(payerData.accountId.value)) {
    transaction.setTransactionId(createTransactionId(payerData.accountId.value, validStart.value));
  }

  if (isAccountId(accountData.accountId.value)) {
    transaction.setAccountId(accountData.accountId.value);
  }

  if (isAccountId(transferAccountData.accountId.value)) {
    transaction.setTransferAccountId(transferAccountData.accountId.value);
  }

  if (transactionMemo.value.length > 0 && transactionMemo.value.length <= MEMO_MAX_LENGTH) {
    transaction.setTransactionMemo(transactionMemo.value);
  }

  return transaction;
}

/* Hooks */
onMounted(async () => {
  if (router.currentRoute.value.query.accountId) {
    accountData.accountId.value = router.currentRoute.value.query.accountId.toString();
  }

  await handleLoadFromDraft();
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleCreate" class="flex-column-100">
      <TransactionHeaderControls heading-text="Delete Account Transaction">
        <template #buttons>
          <SaveDraftButton
            :get-transaction-bytes="() => createTransaction().toBytes()"
            :is-executed="isExecuted || isSubmitted"
          />
          <AppButton
            color="primary"
            type="submit"
            data-testid="button-sign-and-submit-delete"
            :disabled="
              !accountData.isValid.value ||
              !transferAccountData.isValid.value ||
              accountData.accountInfo.value?.deleted ||
              transferAccountData.accountInfo.value?.deleted
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
            <label class="form-label">Account ID <span class="text-danger">*</span></label>
            <label v-if="accountData.isValid.value" class="d-block form-label text-secondary"
              >Balance: {{ accountData.accountInfo.value?.balance || 0 }}</label
            >
            <AppInput
              :model-value="accountData.accountIdFormatted.value"
              @update:model-value="v => (accountData.accountId.value = v)"
              :filled="true"
              data-testid="input-delete-account-id"
              placeholder="Enter Account ID"
            />
          </div>

          <div class="form-group" :class="[columnClass]">
            <AppButton
              v-if="accountData.key.value"
              color="secondary"
              type="button"
              @click="
                isKeyStructureModalShown = true;
                selectedKey = accountData.key.value;
              "
              >Show Key</AppButton
            >
          </div>
        </div>

        <div class="my-4">
          <p
            v-if="accountData.accountInfo.value && accountData.accountInfo.value.deleted"
            class="text-danger mt-4"
          >
            Account is already deleted!
          </p>
        </div>

        <div class="row align-items-end mt-6">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Transfer Account ID <span class="text-danger">*</span></label>
            <label
              v-if="transferAccountData.isValid.value"
              class="d-block form-label text-secondary"
              >Receive Signature Required:
              {{ transferAccountData.accountInfo.value?.receiverSignatureRequired || false }}</label
            >
            <AppInput
              :model-value="transferAccountData.accountIdFormatted.value"
              @update:model-value="v => (transferAccountData.accountId.value = v)"
              :filled="true"
              data-testid="input-transfer-account-id"
              placeholder="Enter Account ID"
            />
          </div>

          <div class="form-group" :class="[columnClass]">
            <AppButton
              v-if="transferAccountData.key.value"
              color="secondary"
              type="button"
              @click="
                isKeyStructureModalShown = true;
                selectedKey = transferAccountData.key.value;
              "
              >Show Key</AppButton
            >
          </div>
        </div>

        <div class="my-4">
          <p
            v-if="
              transferAccountData.accountInfo.value && transferAccountData.accountInfo.value.deleted
            "
            class="text-danger mt-4"
          >
            Account is already deleted!
          </p>
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
      :on-close-success-modal-click="() => $router.push({ name: 'accounts' })"
      :on-executed="handleExecuted"
      :on-submitted="handleSubmit"
    >
      <template #successHeading>Account deleted successfully</template>
      <template #successContent>
        <p
          v-if="transactionProcessor?.transactionResult"
          class="text-small d-flex justify-content-between align-items mt-2"
        >
          <span class="text-bold text-secondary">Account ID:</span>
          <span>{{ accountData.accountIdFormatted.value }}</span>
        </p>
      </template>
    </TransactionProcessor>

    <KeyStructureModal
      v-if="accountData.isValid.value"
      v-model:show="isKeyStructureModalShown"
      :account-key="selectedKey"
    />
  </div>
</template>
