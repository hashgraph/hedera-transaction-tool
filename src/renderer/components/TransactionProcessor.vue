<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';

import { Transaction, TransactionReceipt, TransactionResponse } from '@hashgraph/sdk';

import useUserStore from '../stores/storeUser';
import useKeyPairsStore from '../stores/storeKeyPairs';
import useNetworkStore from '../stores/storeNetwork';

import { useToast } from 'vue-toast-notification';

import { getTransactionSignatures, execute } from '../services/transactionService';
import { openExternal } from '../services/electronUtilsService';

import AppButton from './ui/AppButton.vue';
import AppModal from './ui/AppModal.vue';
import AppLoader from './ui/AppLoader.vue';

/* Props */
const props = defineProps<{
  transactionBytes: Uint8Array | null;
  onExecuted?: (result: {
    response: TransactionResponse;
    receipt: TransactionReceipt;
    transactionId: string;
  }) => void;
  onCloseSuccessModalClick?: () => void;
  watchExecutedModalShown?: (shown: boolean) => void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const keyPairs = useKeyPairsStore();

/* Composables */
const toast = useToast();

/* State */
const transactionResult = ref<{
  response: TransactionResponse;
  receipt: TransactionReceipt;
  transactionId: string;
} | null>();
const userPassword = ref('');
const requiredSignatures = ref<string[]>([]);
const isSigning = ref(false);
const isSignModalShown = ref(false);
const isExecuting = ref(false);
const isExecutedModalShown = ref(false);
const unmounted = ref(false);

/* Computed */
const transaction = computed(() =>
  props.transactionBytes ? Transaction.fromBytes(props.transactionBytes) : null,
);
const externalPublicKeysReq = computed(() =>
  requiredSignatures.value.filter(pk => !keyPairs.publicKeys.includes(pk)),
);
const localPublicKeysReq = computed(() =>
  requiredSignatures.value.filter(pk => keyPairs.publicKeys.includes(pk)),
);
const type = computed(() => transaction.value?.constructor.name);

/* Handlers */
async function handleSignTransaction(e: Event) {
  e.preventDefault();

  let isSigned = false;
  try {
    isSigning.value = true;

    const requiredKeyPairs = keyPairs.keyPairs.filter(kp =>
      localPublicKeysReq.value.includes(kp.publicKey),
    );

    const signatures = await getTransactionSignatures(
      requiredKeyPairs,
      transaction.value as any,
      true,
      user.data.email,
      userPassword.value,
    );

    if (requiredKeyPairs.length === signatures.length) {
      isSigned = true;
    }
  } catch (err: any) {
    handleError(err, 'Transaction signing failed');
  } finally {
    isSigning.value = false;
  }

  if (!isSigned) return;
  isSignModalShown.value = false;

  if (user.data.mode === 'personal') {
    await executeTransaction();
  } else {
    console.log('Send to back end signed along with required', externalPublicKeysReq.value);
  }
}

function handleError(error: any, message: string) {
  if (error.message && typeof error.message === 'string') {
    message = error.message;
  }
  toast.error(message, { position: 'top-right' });
}

/* Functions */
async function process(_requiredSignatures: string[]) {
  await nextTick();
  await keyPairs.refetch();
  resetData();

  requiredSignatures.value = [...new Set(_requiredSignatures)];

  validateProcess();

  // Personal user:
  //  with all local keys -> Execute
  //  with local and external -> FAIL
  //  without local keys but external -> FAIL
  // Organization user:
  //  with all local -> Execute
  //  with local and external -> SIGN AND SEND
  //  without local but external -> SEND

  if (localPublicKeysReq.value.length > 0) {
    isSignModalShown.value = true;
  } else if (user.data.mode === 'organization') {
    console.log('Send to back end along with required external signatures');
  }

  function validateProcess() {
    if (!transaction.value) {
      throw new Error('Transaction not provided');
    }

    if (!user.data.isLoggedIn) {
      throw new Error('User is not logged in');
    }

    if (
      localPublicKeysReq.value.length < requiredSignatures.value.length &&
      user.data.mode === 'personal'
    ) {
      throw new Error(
        'Unable to execute, all of the required signatures should be with your keys. You are currently in Personal mode.',
      );
    }
  }
}

async function executeTransaction() {
  await nextTick();
  if (!transaction.value) {
    throw new Error('Transaction is not provided');
  }

  try {
    isExecuting.value = true;

    transactionResult.value = await execute(
      transaction.value.toBytes().toString(),
      network.network,
      network.customNetworkSettings,
    );
    // To store transaction result locally

    isExecutedModalShown.value = true;
    props.onExecuted && props.onExecuted(transactionResult.value);

    if (unmounted.value) {
      toast.success('Transaction executed', { position: 'top-right' });
    }
  } catch (err: any) {
    handleError(err, 'Transaction execution failed');
  } finally {
    isExecuting.value = false;
  }
}

function resetData() {
  userPassword.value = '';
  transactionResult.value = null;
  isSigning.value = false;
  isExecutedModalShown.value = false;
  isSignModalShown.value = false;
  requiredSignatures.value = [];
}

/* Hooks */
onBeforeUnmount(() => (unmounted.value = true));

/* Expose */
defineExpose({
  transactionResult,
  process,
});
</script>
<template>
  <div>
    <AppModal
      class="common-modal"
      v-model:show="isSignModalShown"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isSignModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-shield-lock extra-large-icon" style="line-height: 16px"></i>
        </div>
        <form @submit="handleSignTransaction">
          <h3 class="mt-5 text-main text-center text-bold">Enter your password</h3>
          <div class="mt-4 form-group">
            <input v-model="userPassword" type="password" class="form-control" />
          </div>
          <AppButton
            color="primary"
            size="large"
            :loading="isSigning"
            :disabled="userPassword.length === 0 || isSigning"
            class="mt-5 w-100"
            type="submit"
            >Sign</AppButton
          >
        </form>
      </div>
    </AppModal>
    <AppModal
      class="common-modal"
      v-model:show="isExecuting"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <i
          class="bi bi-success d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isExecuting = false"
        ></i>
        <div class="mt-5 text-center">
          <AppLoader />
        </div>
        <h3 class="mt-5 text-main text-center text-bold">
          Executing
          {{
            type
              ?.slice(1)
              .split(/(?=[A-Z])/)
              .join(' ')
          }}
        </h3>
        <AppButton color="primary" size="large" class="mt-5 w-100" @click="isExecuting = false"
          >Close</AppButton
        >
      </div>
    </AppModal>
    <AppModal
      class="transaction-success-modal"
      v-model:show="isExecutedModalShown"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <i
          class="bi bi-success d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isExecutedModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-check-lg extra-large-icon" style="line-height: 16px"></i>
        </div>
        <h3 class="mt-5 text-main text-center text-bold"><slot name="successHeading"></slot></h3>
        <p class="mt-4 text-small d-flex justify-content-between align-items">
          <span class="text-bold text-secondary">Transaction ID:</span>
          <a
            class="link-primary cursor-pointer"
            @click="
              network.network !== 'custom' &&
                openExternal(`
            https://hashscan.io/${network.network}/transaction/${transactionResult?.transactionId}`)
            "
            >{{ transactionResult?.transactionId }}</a
          >
        </p>
        <slot name="successContent"></slot>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100"
          @click="
            () => {
              isExecutedModalShown = false;
              onCloseSuccessModalClick && onCloseSuccessModalClick();
            }
          "
          >Close</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
