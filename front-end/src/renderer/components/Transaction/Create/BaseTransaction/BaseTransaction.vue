<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces/organization/approvers';
import { transactionsDataMatch, type TransactionCommonData } from '@renderer/utils/sdk';
import {
  CustomRequest,
  type ExecutedData,
  type ExecutedSuccessData,
} from '@renderer/components/Transaction/TransactionProcessor';
import type { CreateTransactionFunc } from '.';

import { computed, reactive, ref, toRaw, watch } from 'vue';
import { Hbar, Transaction, KeyList, Timestamp } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';
import useLoader from '@renderer/composables/useLoader';

import {
  computeSignatureKey,
  getErrorMessage,
  isAccountId,
  redirectToDetails,
  redirectToGroupDetails,
} from '@renderer/utils';
import { getTransactionCommonData, validate100CharInput } from '@renderer/utils/sdk';
import { getPropagationButtonLabel } from '@renderer/utils/transactions';

import AppInput from '@renderer/components/ui/AppInput.vue';

import BaseTransactionModal from '@renderer/components/Transaction/Create/BaseTransaction/BaseTransactionModal.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionInfoControls from '@renderer/components/Transaction/TransactionInfoControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import TransactionProcessor, {
  TransactionRequest,
} from '@renderer/components/Transaction/TransactionProcessor';
import BaseDraftLoad from '@renderer/components/Transaction/Create/BaseTransaction/BaseDraftLoad.vue';
import BaseGroupHandler from '@renderer/components/Transaction/Create/BaseTransaction/BaseGroupHandler.vue';
import BaseApproversObserverData from '@renderer/components/Transaction/Create/BaseTransaction/BaseApproversObserverData.vue';
import { getTransactionType } from '@renderer/utils/sdk/transactions';

/* Props */
const { createTransaction, preCreateAssert, customRequest, gotUserEdit } = defineProps<{
  createTransaction: CreateTransactionFunc;
  preCreateAssert?: () => boolean | void;
  createDisabled?: boolean;
  customRequest?: CustomRequest;
  gotUserEdit?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'executed', data: ExecutedData): void;
  (event: 'executed:success', data: ExecutedSuccessData): void;
  (event: 'submitted', id: number, body: string): void;
  (event: 'group:submitted', id: number): void;
  (event: 'draft-loaded', transaction: Transaction): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const payerData = useAccountId();
const withLoader = useLoader();

/* State */
const transactionProcessor = ref<InstanceType<typeof TransactionProcessor> | null>(null);
const baseGroupHandlerRef = ref<InstanceType<typeof BaseGroupHandler> | null>(null);

const name = ref('');
const description = ref('');
const submitManually = ref(false);
const reminder = ref<number | null>(null);
const isDraftSaved = ref(false);
const isDraftEdited = ref(gotUserEdit ?? false);

const data = reactive<TransactionCommonData>({
  payerId: '',
  validStart: new Date(),
  maxTransactionFee: new Hbar(2),
  transactionMemo: '',
});

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const isProcessed = ref(false);
const groupActionTaken = ref(false);
const memoError = ref(false);
const initialTransaction = ref<Transaction | null>(null);
const initialDescription = ref('');
const transactionKey = ref<KeyList>(new KeyList([]));

/* Computed */
const transaction = computed(() => createTransaction({ ...data } as TransactionCommonData));

watch(
  () => gotUserEdit,
  () => {
    if (gotUserEdit) {
      isDraftEdited.value = true;
    }
  },
  { immediate: true },
);

const hasTransactionChanged = computed(() => {
  let result: boolean;

  const initialValidStart =
    initialTransaction.value?.transactionId?.validStart ?? Timestamp.fromDate(Date.now());
  const validStart = transaction.value.transactionId?.validStart;
  const now = Timestamp.fromDate(new Date());

  if (validStart && initialTransaction.value) {
    if (
      initialValidStart.compare(validStart) !== 0 &&
      (initialValidStart.compare(now) > 0 || validStart.compare(now) > 0)
    ) {
      result = true; // validStart was updated
    } else {
      // whether tx data match, excluding validStart
      result = !transactionsDataMatch(initialTransaction.value as Transaction, transaction.value);
    }
  } else if (initialTransaction.value === null && !isDraftEdited.value) {
    result = false; // transaction is new and there was no user interaction yet
  } else {
    result = true;
  }
  return result;
});

const hasDescriptionChanged = computed(() => {
  return description.value !== toRaw(initialDescription.value);
});

const hasDataChanged = computed(() => hasTransactionChanged.value || hasDescriptionChanged.value);

/* Handlers */
const handleDraftLoaded = async (transaction: Transaction) => {
  initialTransaction.value = transaction;

  const txData = getTransactionCommonData(transaction) as TransactionCommonData;
  payerData.accountId.value = txData.payerId;
  Object.assign(data, txData);

  emit('draft-loaded', transaction);
};

const handleCreate = async () => {
  basePreCreateAssert();
  if ((await preCreateAssert?.()) === false) return;

  const processable =
    customRequest ||
    TransactionRequest.fromData({
      transactionKey: transactionKey.value,
      transactionBytes: createTransaction({ ...data } as TransactionCommonData).toBytes(),
      name: name.value.trim(),
      description: description.value.trim(),
      submitManually: submitManually.value,
      reminderMillisecondsBefore: reminder.value,
    });

  if (processable instanceof CustomRequest) {
    processable.submitManually = submitManually.value;
    processable.reminderMillisecondsBefore = reminder.value;
    processable.payerId = payerData.accountId.value;
    processable.baseValidStart = data.validStart;
    processable.maxTransactionFee = data.maxTransactionFee as Hbar;
  }

  await withLoader(
    () => transactionProcessor.value?.process(processable, observers.value, approvers.value),
    'Failed to process transaction',
    60 * 1000,
    false,
  );
};

const handleExecuted = async ({ success, response, receipt }: ExecutedData) => {
  isProcessed.value = true;
  if (success && response && receipt) {
    toast.success(`${getTransactionType(transaction.value)} Executed`);
    emit('executed:success', { success, response, receipt });
  }
  emit('executed', { success, response, receipt });
};

const handleSubmit = (id: number, body: string) => {
  isProcessed.value = true;
  redirectToDetails(router, id);
  emit('submitted', id, body);
};

const handleGroupSubmit = (id: number) => {
  isProcessed.value = true;
  redirectToGroupDetails(router, id);
  emit('group:submitted', id);
};

const handleLocalStored = (id: string) => {
  redirectToDetails(router, id);
};

const handleGroupAction = (action: 'add' | 'edit', path?: string) => {
  groupActionTaken.value = true;
  const handle =
    action === 'add'
      ? baseGroupHandlerRef.value?.addGroupItem
      : baseGroupHandlerRef.value?.editGroupItem;
  handle?.(
    description.value,
    payerData.accountId.value,
    data.validStart,
    observers.value,
    approvers.value,
    path,
  );
};

const handleUpdatePayerId = (payerId: string) => {
  payerData.accountId.value = payerId;
  data.payerId = payerId;
};

function handleFetchedDescription(fetchedDescription: string) {
  description.value = fetchedDescription;
  initialDescription.value = fetchedDescription;
}

function handleFetchedPayerAccountId(fetchedPayerAccountId: string) {
  payerData.accountId.value = fetchedPayerAccountId;
}

function handleInputValidation(e: Event) {
  const target = e.target as HTMLInputElement;
  try {
    validate100CharInput(target.value, 'Transaction Memo');
    memoError.value = false;
  } catch (error) {
    toast.error(getErrorMessage(error, 'Invalid Transaction Memo'));
    memoError.value = true;
  }
}

/* Functions */
function basePreCreateAssert() {
  if (!isAccountId(payerData.accountId.value)) {
    throw new Error('Invalid Payer ID');
  }

  if (!data.validStart) {
    throw new Error('Valid Start is required');
  }

  if (data.maxTransactionFee.toBigNumber().lte(0)) {
    throw new Error('Max Transaction Fee is required');
  }
}

async function updateTransactionKey() {
  const computedKeys = await computeSignatureKey(transaction.value, network.mirrorNodeBaseURL);
  transactionKey.value = new KeyList(computedKeys.signatureKeys);
}

/* Watches */
watch([() => payerData.key.value], updateTransactionKey, { immediate: true });

/* Exposes */
defineExpose({
  payerData,
  submit: handleCreate,
  updateTransactionKey,
});
</script>
<template>
  <div class="flex-column-100 overflow-hidden" v-focus-first-input>
    <form @submit.prevent="handleCreate" class="flex-column-100">
      <TransactionHeaderControls
        v-model:submit-manually="submitManually"
        v-model:reminder="reminder"
        :valid-start="data.validStart"
        :is-processed="isProcessed"
        v-on:draft-saved="isDraftSaved = true"
        :create-transaction="() => createTransaction({ ...data } as TransactionCommonData)"
        :description="description"
        :heading-text="getTransactionType(transaction)"
        :create-button-label="
          getPropagationButtonLabel(
            transactionKey,
            user.keyPairs,
            Boolean(user.selectedOrganization),
          )
        "
        :create-button-disabled="
          !payerData.isValid.value || data.maxTransactionFee.toBigNumber().lte(0) || createDisabled
        "
        @add-to-group="handleGroupAction('add')"
        @edit-group-item="handleGroupAction('edit')"
      />

      <hr class="separator my-5" />

      <div class="fill-remaining">
        <TransactionInfoControls v-model:name="name" v-model:description="description" />

        <slot name="entity-nickname" />

        <TransactionIdControls
          class="mt-6"
          :payer-id="payerData.accountId.value"
          @update:payer-id="handleUpdatePayerId"
          v-model:valid-start="data.validStart"
          v-model:max-transaction-fee="data.maxTransactionFee as Hbar"
          @user-edit="isDraftEdited = true"
        />

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <label class="form-label">Transaction Memo</label>
            <AppInput
              @input="handleInputValidation"
              data-testid="input-transaction-memo"
              v-model="data.transactionMemo"
              @update:model-value="isDraftEdited = true"
              :filled="true"
              maxlength="100"
              placeholder="Enter Transaction Memo"
              :class="[memoError ? 'is-invalid' : '']"
            />
          </div>
        </div>

        <hr class="separator my-5" />

        <slot name="default" />

        <BaseApproversObserverData
          v-model:observers="observers"
          v-model:approvers="approvers"
          @update:approvers="isDraftEdited = true"
          @update:observers="isDraftEdited = true"
        />
      </div>
    </form>

    <TransactionProcessor
      ref="transactionProcessor"
      :observers="observers"
      :approvers="approvers"
      :on-executed="handleExecuted"
      :on-submitted="handleSubmit"
      :on-group-submitted="handleGroupSubmit"
      :on-local-stored="handleLocalStored"
    />

    <BaseDraftLoad @draft-loaded="handleDraftLoaded" />
    <BaseGroupHandler
      ref="baseGroupHandlerRef"
      :create-transaction="() => createTransaction({ ...data } as TransactionCommonData)"
      :transaction-key="transactionKey"
      @fetched-description="handleFetchedDescription"
      @fetched-payer-account-id="handleFetchedPayerAccountId"
    />

    <BaseTransactionModal
      :skip="groupActionTaken || isDraftSaved || isProcessed || Boolean(customRequest)"
      @addToGroup="handleGroupAction('add', $event)"
      @editGroupItem="handleGroupAction('edit', $event)"
      :get-transaction="() => createTransaction({ ...data } as TransactionCommonData)"
      :description="description || ''"
      :has-data-changed="hasDataChanged"
    />
  </div>
</template>
