<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
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

import {
  getTransactionFromBytes,
  isAccountId,
  getPropagationButtonLabel,
  formatAccountId,
} from '@renderer/utils';
import { isUserLoggedIn, isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import SaveDraftButton from '@renderer/components/SaveDraftButton.vue';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

/* Stores */
const user = useUserStore();
const transactionGroup = useTransactionGroupStore();

/* Composables */
const router = useRouter();
const route = useRoute();
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
const isConfirmModalShown = ref(false);

const isExecuted = ref(false);
const isSubmitted = ref(false);

/* Computed */
const transactionKey = computed(() => {
  const keyList: Key[] = [];

  payerData.key.value && keyList.push(payerData.key.value);
  accountData.key.value && keyList.push(accountData.key.value);

  if (
    transferAccountData.accountInfo?.value?.receiverSignatureRequired &&
    transferAccountData.key?.value
  ) {
    transferAccountData.key.value && keyList.push(transferAccountData.key.value);
  }

  return new KeyList(keyList);
});

/* Handlers */
const handleFormSubmit = e => {
  e.preventDefault();

  isConfirmModalShown.value = true;
};

const handleCreate = async e => {
  e.preventDefault();

  isConfirmModalShown.value = false;

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
    await transactionProcessor.value?.process(transactionKey.value);
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
      getTransactionFromBytes<AccountDeleteTransaction>(draftTransactionBytes);
    transaction.value = draftTransaction;

    accountData.accountId.value = draftTransaction.accountId?.toString() || '';
    transferAccountData.accountId.value = draftTransaction.transferAccountId?.toString() || '';
    transactionMemo.value = draftTransaction.transactionMemo || '';
  }
};

const handleExecuted = async (success: boolean) => {
  isExecuted.value = true;

  if (!success) return;

  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  try {
    await remove(user.personal.id, [accountData.accountId.value]);
  } catch {
    /* Ignore if not found or error */
  }

  // Counter mirror node delay
  setTimeout(async () => {
    await user.refetchKeys();
    await user.refetchAccounts();
  }, 5000);
};

const handleSubmit = (id: number) => {
  isSubmitted.value = true;
  redirectToDetails(id);
};

const handleLocalStored = (id: string) => {
  toast.success('Account Delete Transaction Executed', { position: 'bottom-right' });
  redirectToDetails(id);
};

function handleAddToGroup() {
  if (!isAccountId(payerData.accountId.value) || !payerData.key.value) {
    throw Error('Invalid Payer ID');
  }

  if (!isAccountId(accountData.accountId.value) || !accountData.key.value) {
    throw Error('Invalid Account ID');
  }

  if (!isAccountId(transferAccountData.accountId.value) || !transferAccountData.key.value) {
    throw Error('Invalid Transfer Account ID');
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
    type: 'AccountDeleteTransaction',
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
    type: 'AccountDeleteTransaction',
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
  const transaction = new AccountDeleteTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionFee.value);

  if (isAccountId(payerData.accountId.value) && !route.params.seq) {
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

async function redirectToDetails(id: string | number) {
  router.push({
    name: 'transactionDetails',
    params: { id },
  });
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
    <form @submit="handleFormSubmit" class="flex-column-100">
      <TransactionHeaderControls heading-text="Delete Account Transaction">
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
              data-testid="button-sign-and-submit-delete"
              :disabled="!accountData.key || !payerData.isValid.value"
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

      <TransactionIdControls
        v-model:payer-id="payerData.accountId.value"
        v-model:valid-start="validStart"
        v-model:max-transaction-fee="maxTransactionFee as Hbar"
      />

      <div class="row mt-6">
        <div class="form-group col-8 col-xxxl-6">
          <label class="form-label">Transaction Memo</label>
          <AppInput
            v-model="transactionMemo"
            :filled="true"
            maxlength="100"
            data-testid="input-delete-account-memo"
            placeholder="Enter Transaction Memo"
          />
        </div>
      </div>

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
              @update:model-value="v => (accountData.accountId.value = formatAccountId(v))"
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

        <div v-if="accountData.isValid.value" class="my-4">
          <p class="text-micro text-secondary">
            <span class="bi bi-info-circle-fill me-2"></span>
            In order to delete this account, you will need to transfer the remaining
            <span class="text-secondary">{{ accountData.accountInfo.value?.balance || 0 }}</span>
            to another account
          </p>
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
              @update:model-value="v => (transferAccountData.accountId.value = formatAccountId(v))"
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
      :on-executed="handleExecuted"
      :on-submitted="handleSubmit"
      :on-local-stored="handleLocalStored"
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

    <AppModal
      class="common-modal"
      v-model:show="isConfirmModalShown"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isConfirmModalShown = false"></i>
        </div>
        <div class="text-center">
          <AppCustomIcon :name="'error'" style="height: 160px" />
        </div>
        <h3 class="text-center text-title text-bold mt-4">
          Are you sure you want to delete the account
          <span class="text-secondary">{{ accountData.accountIdFormatted.value }}</span> ?
        </h3>
        <p class="text-center text-small text-secondary mt-3">
          Deleting this account will permanently remove it from the network. The account cannot be
          restored once deleted.
        </p>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" @click="isConfirmModalShown = false">Cancel</AppButton>
          <AppButton
            color="primary"
            data-testid="button-confirm-delete-account"
            @click="handleCreate"
            >Confirm</AppButton
          >
        </div>
      </div>
    </AppModal>
  </div>
</template>
