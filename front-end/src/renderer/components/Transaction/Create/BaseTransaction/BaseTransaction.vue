<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces/organization/approvers';
import {
  getTransactionCommonData,
  type TransactionCommonData,
  transactionsDataMatch,
  validate100CharInput,
} from '@renderer/utils/sdk';
import TransactionProcessor, {
  CustomRequest,
  type ExecutedData,
  type ExecutedSuccessData,
  TransactionRequest,
} from '@renderer/components/Transaction/TransactionProcessor';
import type { CreateTransactionFunc } from '.';

import { computed, onMounted, reactive, ref, toRaw, watch } from 'vue';
import { Hbar, KeyList, Timestamp, Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';
import useLoader from '@renderer/composables/useLoader';

import { computeSignatureKey, getErrorMessage, isAccountId } from '@renderer/utils';
import { getPropagationButtonLabel } from '@renderer/utils/transactions';

import AppInput from '@renderer/components/ui/AppInput.vue';

import BaseTransactionModal from '@renderer/components/Transaction/Create/BaseTransaction/BaseTransactionModal.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import TransactionInfoControls from '@renderer/components/Transaction/TransactionInfoControls.vue';
import TransactionIdControls from '@renderer/components/Transaction/TransactionIdControls.vue';
import BaseDraftLoad from '@renderer/components/Transaction/Create/BaseTransaction/BaseDraftLoad.vue';
import BaseGroupHandler from '@renderer/components/Transaction/Create/BaseTransaction/BaseGroupHandler.vue';
import BaseApproversObserverData from '@renderer/components/Transaction/Create/BaseTransaction/BaseApproversObserverData.vue';
import { getTransactionType } from '@renderer/utils/sdk/transactions';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';
import useNextTransactionV2, {
  type TransactionNodeId,
} from '@renderer/stores/storeNextTransactionV2.ts';
import { useRouter } from 'vue-router';

/* Props */
const { createTransaction, preCreateAssert, customRequest } = defineProps<{
  createTransaction: CreateTransactionFunc;
  preCreateAssert?: () => boolean | void;
  createDisabled?: boolean;
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
const network = useNetworkStore();
const nextTransaction = useNextTransactionV2();

/* Composables */
const router = useRouter();
const toast = useToast();
const payerData = useAccountId();
const withLoader = useLoader();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();

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
const initialTransaction = ref<Transaction | null>(null);
const initialDescription = ref('');
const transactionKey = ref<KeyList>(new KeyList([]));

/* Computed */
const transaction = computed(() => createTransaction({ ...data } as TransactionCommonData));

const hasTransactionChanged = computed(() => {
  let result: boolean;

  const now = Timestamp.fromDate(new Date());
  const initialValidStart = initialTransaction.value?.transactionId?.validStart ?? now;
  const validStart = transaction.value.transactionId?.validStart ?? now;

  if (initialTransaction.value) {
    if (
      initialValidStart.compare(validStart) !== 0 &&
      (initialValidStart.compare(now) > 0 || validStart.compare(now) > 0)
    ) {
      result = true; // validStart was updated
    } else {
      // whether tx data match, excluding validStart
      result = !transactionsDataMatch(initialTransaction.value as Transaction, transaction.value);
    }
  } else {
    result = true; // initialTransaction is not yet initialized
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

  const txData = getTransactionCommonData(transaction);
  payerData.accountId.value = txData.payerId;
  Object.assign(data, txData);

  emit('draft-loaded', transaction);
};

const handleCreate = async () => {
  basePreCreateAssert();
  if (preCreateAssert?.() === false) return;

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
    toast.success(`${getTransactionType(transaction.value)} Executed`, successToastOptions);
    emit('executed:success', { success, response, receipt });
  }
  emit('executed', { success, response, receipt });
};

const handleSubmit = async (id: number, body: string) => {
  isProcessed.value = true;
  const targetNodeId: TransactionNodeId = { transactionId: id };
  await nextTransaction.routeDown(targetNodeId, [targetNodeId], router);
  emit('submitted', id, body);
};

const handleGroupSubmit = async (id: number) => {
  isProcessed.value = true;
  const targetNodeId: TransactionNodeId = { groupId: id };
  await nextTransaction.routeDown(targetNodeId, [targetNodeId], router);
  emit('group:submitted', id);
};

const handleLocalStored = async (id: string) => {
  const targetNodeId: TransactionNodeId = { transactionId: id };
  await nextTransaction.routeDown(targetNodeId, [targetNodeId], router);
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
    toast.error(getErrorMessage(error, 'Invalid Transaction Memo'), errorToastOptions);
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
  const computedKeys = await computeSignatureKey(
    transaction.value,
    network.mirrorNodeBaseURL,
    accountByIdCache,
    nodeByIdCache,
    user.selectedOrganization,
  );
  transactionKey.value = new KeyList(computedKeys.signatureKeys);
}

/* Hooks */
onMounted(async () => {
  // make sure the transaction is fully initialized before taking snapshot when creating from scratch
  await new Promise(resolve => setTimeout(resolve, 500));
  if (initialTransaction.value === null) {
    initialTransaction.value = transaction.value;
  } // else the existing draft has already been read from storage
});

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
  <div class="flex-column-100 overflow-hidden">
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
