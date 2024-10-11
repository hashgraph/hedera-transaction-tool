<script setup lang="ts">
import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';
import type { ExecutedData, TransactionRequest } from '.';

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

import { assertHandlerExists } from '.';

/* Props */
const props = defineProps<{
  onExecuted?: (data: ExecutedData) => void;
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
const bigFileOrganizationHandler = ref<InstanceType<
  typeof BigFileOrganizationRequestHandler
> | null>(null);
const bigFilePersonalHandler = ref<InstanceType<typeof BigFilePersonalRequestHandler> | null>(null);
const organizationHandler = ref<InstanceType<typeof OrganizationRequestHandler> | null>(null);
const signPersonalHandler = ref<InstanceType<typeof SignPersonalRequestHandler> | null>(null);
const executePersonalHandler = ref<InstanceType<typeof ExecutePersonalRequestHandler> | null>(null);

const observers = ref<number[]>([]);
const approvers = ref<TransactionApproverDto[]>([]);

const isSigning = ref(false);

/* Handlers */
const handleSubmitSuccess = async (id: number, transactionBytes: string) => {
  assertHandlerExists<typeof ConfirmTransactionHandler>(confirmHandler.value, 'Confirm');
  confirmHandler.value.setShow(false);

  toast.success('Transaction submitted successfully');
  props.onSubmitted && (await props.onSubmitted(id, transactionBytes));
};

const handleSubmitFail = () => {
  assertHandlerExists<typeof ConfirmTransactionHandler>(confirmHandler.value, 'Confirm');
  confirmHandler.value.setShow(true);
};

const handleSignBegin = () => {
  isSigning.value = true;
  assertHandlerExists<typeof ConfirmTransactionHandler>(confirmHandler.value, 'Confirm');
  confirmHandler.value.setShow(true);
};

const handleSignSuccess = () => {
  isSigning.value = false;
  assertHandlerExists<typeof ConfirmTransactionHandler>(confirmHandler.value, 'Confirm');
  confirmHandler.value.setShow(false);
};

const handleSignFail = () => {
  isSigning.value = false;
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
  request: TransactionRequest,
  observerUserIds?: number[],
  approverDtos?: TransactionApproverDto[],
) {
  resetData();

  observers.value = observerUserIds || [];
  approvers.value = approverDtos || [];

  buildChain();

  assertHandlerExists<typeof ValidateRequestHandler>(validateHandler.value, 'Validate');
  await validateHandler.value.handle(request);
}

function buildChain() {
  assertHandlerExists<typeof ValidateRequestHandler>(validateHandler.value, 'Validate');
  assertHandlerExists<typeof ConfirmTransactionHandler>(confirmHandler.value, 'Confirm');
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

  validateHandler.value.setNext(confirmHandler.value);
  confirmHandler.value.setNext(bigFileOrganizationHandler.value);
  bigFileOrganizationHandler.value.setNext(bigFilePersonalHandler.value);
  bigFilePersonalHandler.value.setNext(organizationHandler.value);
  organizationHandler.value.setNext(signPersonalHandler.value);
  signPersonalHandler.value.setNext(executePersonalHandler.value);
}

function resetData() {
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

    <!-- Handler #3: Big File Update For Organization (has sub-chain) -->
    <BigFileOrganizationRequestHandler
      ref="bigFileOrganizationHandler"
      :observers="observers"
      :approvers="approvers"
      @transaction:submit:success="handleSubmitSuccess"
      @transaction:submit:fail="handleSubmitFail"
    />

    <!-- Handler #4: Big File Create/Update in Personal (has sub-chain) -->
    <BigFilePersonalRequestHandler
      ref="bigFilePersonalHandler"
      @transaction:sign:begin="handleSignBegin"
      @transaction:sign:success="handleSignSuccess"
      @transaction:sign:fail="handleSignFail"
      @transaction:executed="handleTransactionExecuted"
      @transaction:stored="handleTransactionStore"
    />

    <!-- Handler #5: Organization  -->
    <OrganizationRequestHandler
      ref="organizationHandler"
      :observers="observers"
      :approvers="approvers"
      @transaction:submit:success="handleSubmitSuccess"
      @transaction:submit:fail="handleSubmitFail"
    />

    <!-- Handler #6: Sign in Personal -->
    <SignPersonalRequestHandler
      ref="signPersonalHandler"
      @transaction:sign:begin="handleSignBegin"
      @transaction:sign:success="handleSignSuccess"
      @transaction:sign:fail="handleSignFail"
    />

    <!-- Handler #7: Execute Personal -->
    <ExecutePersonalRequestHandler
      ref="executePersonalHandler"
      @transaction:executed="handleTransactionExecuted"
      @transaction:stored="handleTransactionStore"
    />
  </div>
</template>
