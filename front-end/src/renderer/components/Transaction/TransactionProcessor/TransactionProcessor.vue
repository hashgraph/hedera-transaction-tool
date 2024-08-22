<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, inject } from 'vue';

import { Key, KeyList, Transaction, TransactionReceipt, TransactionResponse } from '@hashgraph/sdk';
import { Prisma } from '@prisma/client';

import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';

import { execute, signTransaction, storeTransaction } from '@renderer/services/transactionService';
import { uint8ArrayToHex } from '@renderer/services/electronUtilsService';
import { decryptPrivateKey, flattenKeyList } from '@renderer/services/keyPairService';
import { deleteDraft, getDraft } from '@renderer/services/transactionDraftsService';
import { addApprovers, addObservers, submitTransaction } from '@renderer/services/organization';

import { USER_PASSWORD_MODAL_KEY, USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import { ableToSign, getStatusFromCode, getTransactionType, getPrivateKey } from '@renderer/utils';
import {
  isLoggedInOrganization,
  isLoggedInWithValidPassword,
  isUserLoggedIn,
} from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import ConfirmTransaction from '@renderer/components/Transaction/ConfirmTransaction.vue';

/* Props */
const props = defineProps<{
  transactionBytes: Uint8Array | null;
  observers?: number[];
  approvers?: TransactionApproverDto[];
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

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const route = useRoute();

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

/* State */
const transactionResult = ref<{
  response: TransactionResponse;
  receipt: TransactionReceipt;
} | null>();
const signatureKey = ref<Key | KeyList | null>(null);
const isConfirmShown = ref(false);
const isSigning = ref(false);
const isExecuting = ref(false);
const isExecutedModalShown = ref(false);
const unmounted = ref(false);

/* Computed */
const transaction = computed(() =>
  props.transactionBytes ? Transaction.fromBytes(props.transactionBytes) : null,
);
const flattenedSignatureKey = computed(() =>
  signatureKey.value ? flattenKeyList(signatureKey.value).map(pk => pk.toStringRaw()) : [],
);
const localPublicKeysReq = computed(() =>
  flattenedSignatureKey.value.filter(pk => user.publicKeys.includes(pk)),
);
const type = computed(() => transaction.value && getTransactionType(transaction.value));

/* Handlers */
async function handleTransactionConfirm() {
  if (user.selectedOrganization) {
    await sendSignedTransactionToOrganization();
  } else if (localPublicKeysReq.value.length > 0) {
    await signAfterConfirm();
  } else {
    throw new Error(
      'Unable to execute, all of the required signatures should be with your keys. You are currently in Personal mode.',
    );
  }
}

async function signAfterConfirm() {
  if (!props.transactionBytes) throw new Error('Transaction not provided');

  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  if (user.selectedOrganization) {
    throw new Error(
      "User is in organization mode, shouldn't be able to sign before submitting to organization",
    );
  }

  /* Verifies the user has entered his password */
  const personalPassword = user.getPassword();
  if (!personalPassword) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    isConfirmShown.value = false;
    userPasswordModalRef.value?.open(
      'Enter your application password',
      'Enter your application password to sign the transaction',
      signAfterConfirm,
    );
    return;
  }

  try {
    isConfirmShown.value = true;
    isSigning.value = true;

    const signedTransactionBytes = await signTransaction(
      props.transactionBytes,
      localPublicKeysReq.value,
      user.personal.id,
      personalPassword,
    );
    isConfirmShown.value = false;

    await executeTransaction(signedTransactionBytes);
  } catch (err: any) {
    toast.error(err.message || 'Transaction signing failed', { position: 'bottom-right' });
  } finally {
    isSigning.value = false;
  }
}

/* Functions */
async function process(requiredKey: Key) {
  resetData();
  signatureKey.value = requiredKey;

  await nextTick();
  await user.refetchKeys();

  validateProcess();

  await nextTick();

  isConfirmShown.value = true;

  await user.refetchAccounts();

  function validateProcess() {
    if (!transaction.value) {
      throw new Error('Transaction not provided');
    }

    if (!isUserLoggedIn(user.personal)) {
      throw new Error('User is not logged in');
    }

    if (
      signatureKey.value &&
      !ableToSign(user.publicKeys, signatureKey.value) &&
      !user.selectedOrganization
    ) {
      throw new Error(
        'Unable to execute, all of the required signatures should be with your keys. You are currently in Personal mode.',
      );
    }
  }
}

async function executeTransaction(transactionBytes: Uint8Array) {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  let status = 0;

  try {
    isExecuting.value = true;

    const { response, receipt } = await execute(transactionBytes);

    transactionResult.value = { response, receipt };
    status = receipt.status._code;

    isExecutedModalShown.value = true;
    props.onExecuted && props.onExecuted(true, response, receipt);

    if (route.query.draftId) {
      try {
        const draft = await getDraft(route.query.draftId.toString());

        if (!draft.isTemplate) {
          await deleteDraft(route.query.draftId.toString());
        }
      } catch (error) {
        console.log(error);
      }
    }

    if (unmounted.value) {
      toast.success('Transaction executed', { position: 'bottom-right' });
    }
  } catch (err: any) {
    const data = JSON.parse(err.message);
    status = data.status;

    props.onExecuted && props.onExecuted(false);
    toast.error(data.message, { position: 'bottom-right' });
  } finally {
    isExecuting.value = false;
  }

  const executedTransaction = Transaction.fromBytes(transactionBytes);

  if (!type.value || !executedTransaction.transactionId) throw new Error('Cannot save transaction');

  const tx: Prisma.TransactionUncheckedCreateInput = {
    name: `${type.value} (${executedTransaction.transactionId.toString()})`,
    type: type.value,
    description: '',
    transaction_id: executedTransaction.transactionId.toString(),
    transaction_hash: (await executedTransaction.getTransactionHash()).toString(),
    body: transactionBytes.toString(),
    status: getStatusFromCode(status) || 'UNKNOWN',
    status_code: status,
    user_id: user.personal.id,
    creator_public_key: null,
    signature: '',
    valid_start: executedTransaction.transactionId.validStart?.toString() || '',
    executed_at: new Date().getTime() / 1000,
    network: network.network,
  };

  const { id } = await storeTransaction(tx);
  props.onLocalStored && props.onLocalStored(id);
}

async function sendSignedTransactionToOrganization() {
  isConfirmShown.value = false;

  /* Verifies the user is logged in organization */
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    throw new Error('Please select an organization');
  }

  /* Verifies the user has entered his password */
  const personalPassword = user.getPassword();
  if (!isLoggedInWithValidPassword(user.personal) || !personalPassword) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    userPasswordModalRef.value?.open(
      'Enter your application password',
      'Enter your application password to sign as a creator',
      sendSignedTransactionToOrganization,
    );
    return;
  }

  /* Verifies there is actual transaction to process */
  if (!props.transactionBytes) throw new Error('Transaction not provided');

  /* User Serializes the Transaction */
  const hexTransactionBytes = await uint8ArrayToHex(props.transactionBytes);

  /* Signs the unfrozen transaction */
  const keyToSignWith = user.keyPairs[0].public_key;

  const privateKeyRaw = await decryptPrivateKey(user.personal.id, personalPassword, keyToSignWith);
  const privateKey = getPrivateKey(keyToSignWith, privateKeyRaw);

  const signature = privateKey.sign(props.transactionBytes);
  const signatureHex = await uint8ArrayToHex(signature);

  /* Submit the transaction to the back end */
  const { id, body } = await submitTransaction(
    user.selectedOrganization.serverUrl,
    transaction.value?.transactionMemo || `New ${type.value}`,
    transaction.value?.transactionMemo || '',
    hexTransactionBytes,
    network.network,
    signatureHex,
    user.selectedOrganization.userKeys.find(k => k.publicKey === keyToSignWith)?.id || -1,
  );

  toast.success('Transaction submitted successfully');
  props.onSubmitted && props.onSubmitted(id, body);

  const results = await Promise.allSettled([
    // uploadSignatures(body, id),
    uploadObservers(id),
    uploadApprovers(id),
    deleteDraftIfNotTemplate(),
  ]);

  results.forEach(result => {
    if (result.status === 'rejected') {
      toast.error(result.reason.message);
    }
  });
}

async function uploadObservers(transactionId: number) {
  if (!props.observers || props.observers.length === 0) return;

  if (!isLoggedInOrganization(user.selectedOrganization))
    throw new Error('User is not logged in organization');

  await addObservers(user.selectedOrganization.serverUrl, transactionId, props.observers);
}

async function uploadApprovers(transactionId: number) {
  if (!props.approvers || props.approvers.length === 0) return;

  if (!isLoggedInOrganization(user.selectedOrganization))
    throw new Error('User is not logged in organization');

  await addApprovers(user.selectedOrganization.serverUrl, transactionId, props.approvers);
}

async function deleteDraftIfNotTemplate() {
  /* Delete if draft and not template */
  if (route.query.draftId) {
    try {
      const draft = await getDraft(route.query.draftId.toString());
      if (!draft.isTemplate) await deleteDraft(route.query.draftId.toString());
    } catch (error) {
      console.log(error);
    }
  }
}

function resetData() {
  transactionResult.value = null;
  isSigning.value = false;
  isExecuting.value = false;
  isExecutedModalShown.value = false;
  signatureKey.value = null;
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
    <!-- Confirm modal -->
    <template v-if="transaction">
      <ConfirmTransaction
        v-model:show="isConfirmShown"
        :transaction="transaction"
        :signing="isSigning"
        @transaction:confirm="handleTransactionConfirm"
      />
    </template>
    <!-- Executing modal -->
    <AppModal
      v-model:show="isExecuting"
      class="common-modal"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isExecuting = false"></i>
        </div>
        <div class="text-center">
          <AppLoader />
        </div>
        <h3 class="text-center text-title text-bold mt-5">
          Executing
          {{ type }}
        </h3>
        <hr class="separator my-5" />

        <div class="d-grid">
          <AppButton color="primary" @click="isExecuting = false">Close</AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>
