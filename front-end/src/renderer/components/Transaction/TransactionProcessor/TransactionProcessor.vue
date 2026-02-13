<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces/organization/approvers';
import type { ExecutedData, Processable } from '.';

import { ref } from 'vue';

import { TransactionReceipt, TransactionResponse } from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';

import ConfirmTransactionHandler from './components/ConfirmTransactionHandler.vue';
import ValidateRequestHandler from './components/ValidateRequestHandler.vue';
import BigFileOrganizationRequestHandler from './components/BigFileOrganizationRequestHandler.vue';
import BigFilePersonalRequestHandler from './components/BigFilePersonalRequestHandler.vue';
import OrganizationRequestHandler from './components/OrganizationRequestHandler.vue';
import SignPersonalRequestHandler from './components/SignPersonalRequestHandler.vue';
import ExecutePersonalRequestHandler from './components/ExecutePersonalRequestHandler.vue';
import MultipleAccountUpdateRequestHandler from './components/MultipleAccountUpdateRequestHandler.vue';
import CheckKeySettingHandler from '@renderer/components/Transaction/TransactionProcessor/components/CheckKeySettingHandler.vue';

import { assertHandlerExists } from '.';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Props */
const props = defineProps<{
  onExecuted?: (data: ExecutedData) => void;
  onSubmitted?: (id: number, body: string) => void;
  onGroupSubmitted?: (id: number) => void;
  onLocalStored?: (id: string) => void;
  onCloseSuccessModalClick?: () => void;
  watchExecutedModalShown?: (shown: boolean) => void;
  hasDataChanged: boolean;
  saveDraft: () => Promise<void>;
}>();

/* Composables */
const toast = useToast();

/* State */
/** Handlers */
const checkKeySettingHandler = ref<InstanceType<typeof CheckKeySettingHandler> | null>(null);
const validateHandler = ref<InstanceType<typeof ValidateRequestHandler> | null>(null);
const confirmHandler = ref<InstanceType<typeof ConfirmTransactionHandler> | null>(null);
const multipleAccountUpdateHandler = ref<InstanceType<
  typeof MultipleAccountUpdateRequestHandler
> | null>(null);
const bigFileOrganizationHandler = ref<InstanceType<
  typeof BigFileOrganizationRequestHandler
> | null>(null);
const bigFilePersonalHandler = ref<InstanceType<typeof BigFilePersonalRequestHandler> | null>(null);
const organizationHandler = ref<InstanceType<typeof OrganizationRequestHandler> | null>(null);
const signPersonalHandler = ref<InstanceType<typeof SignPersonalRequestHandler> | null>(null);
const executePersonalHandler = ref<InstanceType<typeof ExecutePersonalRequestHandler> | null>(null);

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const isLoading = ref(false);

/* Handlers */
const handleGroupSubmitSuccess = async (id: number) => {
  setConfirmModalShown(false);
  toast.success('Transaction group submitted successfully', successToastOptions);
  props.onGroupSubmitted && (await props.onGroupSubmitted(id));
};

const handleSubmitSuccess = async (id: number, transactionBytes: string) => {
  setConfirmModalShown(false);
  toast.success('Transaction submitted successfully', successToastOptions);
  props.onSubmitted && (await props.onSubmitted(id, transactionBytes));
};

const handleSubmitFail = () => {
  setConfirmModalShown(true);
};

const handleSignBegin = () => {
  handleLoading(true);
  setConfirmModalShown(true);
};

const handleSignSuccess = () => {
  handleLoading(false);
  setConfirmModalShown(false);
};

const handleLoading = (loading: boolean) => {
  isLoading.value = loading;
};

const handleTransactionExecuted = (
  success: boolean,
  response: TransactionResponse | null,
  receipt: TransactionReceipt | null,
) => {
  props.onExecuted && props.onExecuted({ success, response, receipt });
};

const handleTransactionStore = (id: string) => {
  props.onLocalStored && props.onLocalStored(id);
};

/* Functions */
async function process(
  request: Processable,
  observerUserIds?: number[],
  approverDtos?: TransactionApproverDto[],
) {
  resetData();

  observers.value = observerUserIds || [];
  approvers.value = approverDtos || [];

  buildChain();

  assertHandlerExists<typeof CheckKeySettingHandler>(
    checkKeySettingHandler.value,
    'CheckKeySetting',
  );
  checkKeySettingHandler.value.handle(request);
}

function buildChain() {
  assertHandlerExists<typeof CheckKeySettingHandler>(
    checkKeySettingHandler.value,
    'CheckKeySetting',
  );
  assertHandlerExists<typeof ValidateRequestHandler>(validateHandler.value, 'Validate');
  assertHandlerExists<typeof ConfirmTransactionHandler>(confirmHandler.value, 'Confirm');
  assertHandlerExists<typeof MultipleAccountUpdateRequestHandler>(
    multipleAccountUpdateHandler.value,
    'Multiple Accounts Update',
  );
  assertHandlerExists<typeof BigFileOrganizationRequestHandler>(
    bigFileOrganizationHandler.value,
    'Large File Create/Update',
  );
  assertHandlerExists<typeof BigFilePersonalRequestHandler>(
    bigFilePersonalHandler.value,
    'Large File Create/Update',
  );
  assertHandlerExists<typeof OrganizationRequestHandler>(organizationHandler.value, 'Organization');
  assertHandlerExists<typeof SignPersonalRequestHandler>(
    signPersonalHandler.value,
    'Sign Personal',
  );
  assertHandlerExists<typeof ExecutePersonalRequestHandler>(
    executePersonalHandler.value,
    'Execute Personal',
  );

  checkKeySettingHandler.value.setNext(validateHandler.value);
  validateHandler.value.setNext(confirmHandler.value);
  confirmHandler.value.setNext(multipleAccountUpdateHandler.value);
  multipleAccountUpdateHandler.value.setNext(bigFileOrganizationHandler.value);
  bigFileOrganizationHandler.value.setNext(bigFilePersonalHandler.value);
  bigFilePersonalHandler.value.setNext(organizationHandler.value);
  organizationHandler.value.setNext(signPersonalHandler.value);
  signPersonalHandler.value.setNext(executePersonalHandler.value);
}

function setConfirmModalShown(value: boolean) {
  assertHandlerExists<typeof ConfirmTransactionHandler>(confirmHandler.value, 'Confirm');
  confirmHandler.value.setShow(value);
}

function resetData() {
  observers.value = [];
  approvers.value = [];
  isLoading.value = false;
}

/* Expose */
defineExpose({
  process,
});
</script>
<template>
  <div>
    <!-- Handler #0: Check at least one private key is set -->
    <CheckKeySettingHandler ref="checkKeySettingHandler" :save-draft="props.saveDraft" :hasDataChanged="props.hasDataChanged" />

    <!-- Handler #1: Validation -->
    <ValidateRequestHandler ref="validateHandler" />

    <!-- Handler #2: Confirm modal -->
    <ConfirmTransactionHandler ref="confirmHandler" :loading="isLoading" />

    <!-- Handler #3: Multiple Accounts Update (has sub-chain) -->
    <MultipleAccountUpdateRequestHandler
      ref="multipleAccountUpdateHandler"
      :observers="observers"
      :approvers="approvers"
      @transaction:sign:begin="handleSignBegin"
      @transaction:sign:success="handleSignSuccess"
      @transaction:sign:fail="handleLoading(false)"
      @transaction:executed="handleTransactionExecuted"
      @transaction:stored="handleTransactionStore"
      @transaction:group:submit:success="handleGroupSubmitSuccess"
      @transaction:group:submit:fail="handleSubmitFail"
      @loading:begin="handleLoading(true)"
      @loading:end="handleLoading(false)"
    />

    <!-- Handler #4: Big File Update For Organization -->
    <BigFileOrganizationRequestHandler
      ref="bigFileOrganizationHandler"
      :observers="observers"
      :approvers="approvers"
      @transaction:group:submit:success="handleGroupSubmitSuccess"
      @transaction:group:submit:fail="handleSubmitFail"
      @loading:begin="handleLoading(true)"
      @loading:end="handleLoading(false)"
    />

    <!-- Handler #5: Big File Create/Update in Personal (has sub-chain) -->
    <BigFilePersonalRequestHandler
      ref="bigFilePersonalHandler"
      @transaction:sign:begin="handleSignBegin"
      @transaction:sign:success="handleSignSuccess"
      @transaction:sign:fail="handleLoading(false)"
      @transaction:executed="handleTransactionExecuted"
      @transaction:stored="handleTransactionStore"
    />

    <!-- Handler #6: Organization  -->
    <OrganizationRequestHandler
      ref="organizationHandler"
      :observers="observers"
      :approvers="approvers"
      @transaction:submit:success="handleSubmitSuccess"
      @transaction:submit:fail="handleSubmitFail"
      @loading:begin="handleLoading(true)"
      @loading:end="handleLoading(false)"
    />

    <!-- Handler #7: Sign in Personal -->
    <SignPersonalRequestHandler
      ref="signPersonalHandler"
      @transaction:sign:begin="handleSignBegin"
      @transaction:sign:success="handleSignSuccess"
      @transaction:sign:fail="handleLoading(false)"
    />

    <!-- Handler #8: Execute Personal -->
    <ExecutePersonalRequestHandler
      ref="executePersonalHandler"
      @transaction:executed="handleTransactionExecuted"
      @transaction:stored="handleTransactionStore"
    />
  </div>
</template>
