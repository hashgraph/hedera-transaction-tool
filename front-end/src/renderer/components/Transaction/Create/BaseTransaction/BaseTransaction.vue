<script setup lang="ts">
import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';
import type { TransactionCommonData } from '@renderer/utils/sdk';
import {
  CustomRequest,
  type ExecutedData,
  type ExecutedSuccessData,
} from '@renderer/components/Transaction/TransactionProcessor';
import type { CreateTransactionFunc } from '.';

import { computed, reactive, ref, toRaw } from 'vue';
import { Hbar, Transaction, KeyList } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';
import useLoader from '@renderer/composables/useLoader';

import {
  getErrorMessage,
  isAccountId,
  redirectToDetails,
  redirectToGroupDetails,
} from '@renderer/utils';
import { getTransactionCommonData, validate100CharInput } from '@renderer/utils/sdk';
import { getTransactionType } from '@renderer/utils/sdk/transactions';
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

/* Props */
const { createTransaction, preCreateAssert, transactionBaseKey, customRequest } = defineProps<{
  createTransaction: CreateTransactionFunc;
  preCreateAssert?: () => boolean | void;
  createDisabled?: boolean;
  transactionBaseKey?: KeyList;
  customRequest?: CustomRequest;
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
const initialTransactionData = ref('');
const initialDescription = ref('');

/* Computed */
const transaction = computed(() => createTransaction({ ...data } as TransactionCommonData));

const transactionKey = computed(() => {
  const keys = transactionBaseKey?.toArray() || [];
  payerData.key.value && keys.push(payerData.key.value);
  return new KeyList(keys);
});

const hasTransactionChanged = computed(() => {
  if (!initialTransactionData.value) return false;

  const currentTransactionData = transaction.value.toBytes().join(',');

  return currentTransactionData !== initialTransactionData.value;
});

const hasDescriptionChanged = computed(() => {
  return description.value !== toRaw(initialDescription.value);
});

const hasDataChanged = computed(() => hasTransactionChanged.value || hasDescriptionChanged.value);

/* Handlers */
const handleDraftLoaded = async (transaction: Transaction) => {
  const txBytes = transaction.toBytes().join(',');

  const txData = getTransactionCommonData(transaction) as TransactionCommonData;
  payerData.accountId.value = txData.payerId;
  Object.assign(data, txData);

  initialTransactionData.value = txBytes;
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

/* Exposes */
defineExpose({
  payerData,
  submit: handleCreate,
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
          @update:payer-id="((payerData.accountId.value = $event), (data.payerId = $event))"
          v-model:valid-start="data.validStart"
          v-model:max-transaction-fee="data.maxTransactionFee as Hbar"
        />

        <div class="row mt-6">
          <div class="form-group col-8 col-xxxl-6">
            <label class="form-label">Transaction Memo</label>
            <AppInput
              @input="handleInputValidation"
              data-testid="input-transaction-memo"
              v-model="data.transactionMemo"
              :filled="true"
              maxlength="100"
              placeholder="Enter Transaction Memo"
              :class="[memoError ? 'is-invalid' : '']"
            />
          </div>
        </div>

        <hr class="separator my-5" />

        <slot name="default" />

        <BaseApproversObserverData v-model:observers="observers" v-model:approvers="approvers" />
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
