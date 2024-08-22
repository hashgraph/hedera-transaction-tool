<script setup lang="ts">
import { ref } from 'vue';

import { TransactionReceipt, TransactionResponse } from '@hashgraph/sdk';

import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import { useToast } from 'vue-toast-notification';

import ConfirmTransactionHandler from './components/ConfirmTransactionHandler.vue';
import ValidateRequestHandler from './components/ValidateRequestHandler.vue';
import BigFileRequestHandler from './components/BigFileRequestHandler.vue';
import OrganizationRequestHandler from './components/OrganizationRequestHandler.vue';
import SignPersonalRequestHandler from './components/SignPersonalRequestHandler.vue';
import ExecutePersonalRequestHandler from './components/ExecutePersonalRequestHandler.vue';

import { TransactionRequest } from '.';

/* Props */
const props = defineProps<{
  onExecuted?: (
    success: boolean,
    response?: TransactionResponse,
    receipt?: TransactionReceipt,
  ) => void;
  onSubmitted?: (id: number, body: string) => void;
  onLocalStored?: (id: string) => void;
  onCloseSuccessModalClick?: () => void;
  watchExecutedModalShown?: (shown: boolean) => void;
}>();

/* Composables */
const toast = useToast();

/* State */
/** Handlers */
const validateHandler = ref<InstanceType<typeof ValidateRequestHandler> | null>(null);
const confirmHandler = ref<InstanceType<typeof ConfirmTransactionHandler> | null>(null);
const fileCreateHandler = ref<InstanceType<typeof BigFileRequestHandler> | null>(null);
const organizationHandler = ref<InstanceType<typeof OrganizationRequestHandler> | null>(null);
const signPersonalHandler = ref<InstanceType<typeof SignPersonalRequestHandler> | null>(null);
const executePersonalHandler = ref<InstanceType<typeof ExecutePersonalRequestHandler> | null>(null);

const transactionBytes = ref<Uint8Array | null>(null);
const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const isSigning = ref(false);

/* Handlers */
const handleSubmitSuccess = async (id: number, body: string) => {
  assertHandlerExists<typeof ConfirmTransactionHandler>(confirmHandler.value, 'Validate');
  confirmHandler.value.setShow(false);

  toast.success('Transaction submitted successfully');
  props.onSubmitted && (await props.onSubmitted(id, body));
};

const handleSubmitFail = () => {
  assertHandlerExists<typeof ConfirmTransactionHandler>(confirmHandler.value, 'Validate');
  confirmHandler.value.setShow(true);
};

const handleSignBegin = () => {
  isSigning.value = true;
  assertHandlerExists<typeof ConfirmTransactionHandler>(confirmHandler.value, 'Validate');
  confirmHandler.value.setShow(true);
};

const handleSignSuccess = () => {
  isSigning.value = false;
  assertHandlerExists<typeof ConfirmTransactionHandler>(confirmHandler.value, 'Validate');
  confirmHandler.value.setShow(false);
};

const handleSignFail = () => {
  isSigning.value = false;
};

const handleTransactionExecuted = (
  success: boolean,
  response?: TransactionResponse,
  receipt?: TransactionReceipt,
) => {
  props.onExecuted && props.onExecuted(success, response, receipt);
};

const handleTransactionStore = (id: string) => {
  props.onLocalStored && props.onLocalStored(id);
};

/* Functions */
async function process(
  request: TransactionRequest,
  observerUserIds?: number[],
  approverDtos?: TransactionApproverDto[],
) {
  resetData();

  transactionBytes.value = request.transactionBytes;
  observers.value = observerUserIds || [];
  approvers.value = approverDtos || [];

  buildChain();

  assertHandlerExists<typeof ValidateRequestHandler>(validateHandler.value, 'Validate');
  await validateHandler.value.handle(request);
}

function buildChain() {
  assertHandlerExists<typeof ValidateRequestHandler>(validateHandler.value, 'Validate');
  assertHandlerExists<typeof ConfirmTransactionHandler>(confirmHandler.value, 'Confirm');
  assertHandlerExists<typeof BigFileRequestHandler>(fileCreateHandler.value, 'File Create');
  assertHandlerExists<typeof OrganizationRequestHandler>(organizationHandler.value, 'Organization');
  assertHandlerExists<typeof SignPersonalRequestHandler>(
    signPersonalHandler.value,
    'Sign Personal',
  );
  assertHandlerExists<typeof ExecutePersonalRequestHandler>(
    executePersonalHandler.value,
    'Execute Personal',
  );

  validateHandler.value.setNext(confirmHandler.value);
  confirmHandler.value.setNext(fileCreateHandler.value);
  fileCreateHandler.value.setNext(organizationHandler.value);
  organizationHandler.value.setNext(signPersonalHandler.value);
  signPersonalHandler.value.setNext(executePersonalHandler.value);
}

function assertHandlerExists<T extends abstract new (...args: any) => any>(
  handler,
  name,
): asserts handler is InstanceType<T> {
  if (!handler) throw new Error(`${name} handler is not provided`);
}

function resetData() {
  transactionBytes.value = null;
  observers.value = [];
  approvers.value = [];
  isSigning.value = false;
}

/* Expose */
defineExpose({
  process,
});
</script>
<template>
  <div>
    <!-- Handler #1: Validation -->
    <ValidateRequestHandler ref="validateHandler" />

    <!-- Handler #2: Confirm modal -->
    <ConfirmTransactionHandler ref="confirmHandler" :signing="isSigning" />

    <!-- Handler #3: File Create (has sub-chain) -->
    <BigFileRequestHandler ref="fileCreateHandler" />

    <!-- Handler #4: Orgnization  -->
    <OrganizationRequestHandler
      ref="organizationHandler"
      :observers="observers"
      :approvers="approvers"
      @transaction:submit:success="handleSubmitSuccess"
      @transaction:submit:fail="handleSubmitFail"
    />

    <!-- Handler #5: Sign in Personal -->
    <SignPersonalRequestHandler
      ref="signPersonalHandler"
      @transaction:sign:begin="handleSignBegin"
      @transaction:sign:success="handleSignSuccess"
      @transaction:sign:fail="handleSignFail"
    />

    <!-- Handler #6: Execute Personal -->
    <ExecutePersonalRequestHandler
      ref="executePersonalHandler"
      @transaction:executed="handleTransactionExecuted"
      @transaction:stored="handleTransactionStore"
    />
  </div>
</template>
