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
import {
  hexToUint8Array,
  openExternal,
  uint8ArrayToHex,
} from '@renderer/services/electronUtilsService';
import { getDollarAmount } from '@renderer/services/mirrorNodeDataService';
import { decryptPrivateKey, flattenKeyList } from '@renderer/services/keyPairService';
import { deleteDraft, getDraft } from '@renderer/services/transactionDraftsService';
import {
  addApprovers,
  addObservers,
  fullUploadSignatures,
  submitTransaction,
} from '@renderer/services/organization';

import { USER_PASSWORD_MODAL_KEY, USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import {
  ableToSign,
  stringifyHbar,
  getStatusFromCode,
  getTransactionType,
  getPrivateKey,
} from '@renderer/utils';
import { publicRequiredToSign } from '@renderer/utils/transactionSignatureModels';
import {
  isLoggedInOrganization,
  isLoggedInWithPassword,
  isUserLoggedIn,
} from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Props */
const props = defineProps<{
  transactionBytes: Uint8Array | null;
  observers?: number[];
  approvers?: TransactionApproverDto[];
  onExecuted?: (response: TransactionResponse, receipt: TransactionReceipt) => void;
  onSubmitted?: (id: number, body: string) => void;
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
const userPassword = ref('');
const signatureKey = ref<Key | KeyList | null>(null);
const isConfirmShown = ref(false);
const isSigning = ref(false);
const isSignModalShown = ref(false);
const isChunkingModalShown = ref(false);
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
async function handleConfirmTransaction(e: Event) {
  e.preventDefault();

  // Personal user:
  //  with all local keys -> Execute
  //  with local and external -> FAIL
  //  without local keys but external -> FAIL
  // Organization user:
  //  with all local -> SIGN AND SEND
  //  with local and external -> SIGN AND SEND
  //  without local but external -> SEND

  if (user.selectedOrganization) {
    await sendSignedTransactionToOrganization();
  } else if (localPublicKeysReq.value.length > 0) {
    isConfirmShown.value = false;
    isSignModalShown.value = true;
  } else {
    throw new Error(
      'Unable to execute, all of the required signatures should be with your keys. You are currently in Personal mode.',
    );
  }
}

async function handleSignTransaction(e: Event) {
  e.preventDefault();

  if (!props.transactionBytes) throw new Error('Transaction not provided');

  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  if (user.selectedOrganization) {
    throw new Error(
      "User is in organization mode, shouldn't be able to sign before submitting to organization",
    );
  }

  try {
    isSigning.value = true;

    const signedTransactionBytes = await signTransaction(
      props.transactionBytes,
      localPublicKeysReq.value,
      user.personal.id,
      userPassword.value,
    );

    isSignModalShown.value = false;

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

    props.onExecuted && props.onExecuted(response, receipt);

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
    status: getStatusFromCode(status),
    status_code: status,
    user_id: user.personal.id,
    creator_public_key: null,
    signature: '',
    valid_start: executedTransaction.transactionId.validStart?.toString() || '',
    executed_at: new Date().getTime() / 1000,
    group_id: null,
  };

  await storeTransaction(tx);
}

async function sendSignedTransactionToOrganization() {
  isConfirmShown.value = false;

  /* Verifies the user is logged in organization */
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    throw new Error('Please select an organization');
  }

  /* Verifies the user has entered his password */
  if (!isLoggedInWithPassword(user.personal)) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    userPasswordModalRef.value?.open(
      'Enter your personal account password',
      'Enter your personal to sign as a creator',
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

  const privateKeyRaw = await decryptPrivateKey(
    user.personal.id,
    user.personal.password,
    keyToSignWith,
  );
  const privateKey = getPrivateKey(keyToSignWith, privateKeyRaw);

  const signature = privateKey.sign(props.transactionBytes);
  const signatureHex = await uint8ArrayToHex(signature);

  /* Submit the transaction to the back end */
  const { id, body } = await submitTransaction(
    user.selectedOrganization.serverUrl,
    transaction.value?.transactionMemo || `New ${type.value}`,
    transaction.value?.transactionMemo || '',
    hexTransactionBytes,
    signatureHex,
    user.selectedOrganization.userKeys.find(k => k.publicKey === keyToSignWith)?.id || -1,
  );

  toast.success('Transaction submitted successfully');
  props.onSubmitted && props.onSubmitted(id, body);

  const results = await Promise.allSettled([
    uploadSignatures(body, id),
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

async function uploadSignatures(
  organizationTransactionBody: string,
  organizationTransactionId: number,
) {
  const callback = async () => {
    /* Verifies the user has entered his password */
    if (!isLoggedInOrganization(user.selectedOrganization))
      throw new Error('User is not logged in organization');

    if (!isLoggedInWithPassword(user.personal)) {
      if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
      userPasswordModalRef.value?.open(
        'Enter your personal account password',
        'Enter your personal to sign as a creator',
        callback,
      );
      return;
    }

    const bodyBytes = await hexToUint8Array(organizationTransactionBody);

    /* Deserialize the transaction */
    const sdkTransaction = Transaction.fromBytes(bodyBytes);

    /* Check if should sign */
    const publicKeysRequired = await publicRequiredToSign(
      sdkTransaction,
      user.selectedOrganization.userKeys,
      network.mirrorNodeBaseURL,
    );
    if (publicKeysRequired.length === 0) return;

    await fullUploadSignatures(
      user.personal,
      user.selectedOrganization,
      publicKeysRequired,
      sdkTransaction,
      organizationTransactionId,
    );

    toast.success('Transaction signed successfully');
  };
  await callback();
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
  userPassword.value = '';
  transactionResult.value = null;
  isSigning.value = false;
  isExecuting.value = false;
  isExecutedModalShown.value = false;
  isChunkingModalShown.value = false;
  isSignModalShown.value = false;
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
    <AppModal
      v-model:show="isConfirmShown"
      class="large=modal"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isConfirmShown = false"></i>
        </div>
        <div class="text-center">
          <i class="bi bi-arrow-left-right large-icon"></i>
        </div>
        <form @submit="handleConfirmTransaction">
          <h3 class="text-center text-title text-bold mt-5">Confirm Transaction</h3>
          <div class="container-main-bg text-small p-4 mt-5">
            <div class="d-flex justify-content-between p-3">
              <p>Type of Transaction</p>
              <p data-testid="p-type-transaction">{{ type }}</p>
            </div>
            <div class="d-flex justify-content-between p-3 mt-3">
              <p>Transaction ID</p>
              <p class="text-secondary" data-testid="p-transaction-id">
                {{ transaction?.transactionId }}
              </p>
            </div>
            <div class="d-flex justify-content-between p-3 mt-3">
              <p>Valid Start</p>
              <p class="">
                {{ transaction?.transactionId?.validStart?.toDate().toDateString() }}
              </p>
            </div>
            <div
              v-if="transaction?.maxTransactionFee"
              class="d-flex justify-content-between p-3 mt-3"
            >
              <p>Max Transaction Fee</p>
              <p class="" data-testid="p-max-tx-fee">
                {{ stringifyHbar(transaction.maxTransactionFee) }} ({{
                  getDollarAmount(network.currentRate, transaction.maxTransactionFee.toBigNumber())
                }})
              </p>
            </div>
          </div>

          <hr class="separator my-5" />

          <div class="flex-between-centered gap-4">
            <AppButton
              type="button"
              color="borderless"
              data-testid="button-cancel-transaction"
              @click="isConfirmShown = false"
              >Cancel</AppButton
            >
            <AppButton color="primary" type="submit" data-testid="button-sign-transaction"
              >Sign</AppButton
            >
          </div>
        </form>
      </div>
    </AppModal>
    <!-- Sign modal -->
    <AppModal
      v-model:show="isSignModalShown"
      class="common-modal"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isSignModalShown = false"></i>
        </div>
        <div class="text-center">
          <AppCustomIcon :name="'lock'" style="height: 160px" />
        </div>
        <form class="mt-3" @submit="handleSignTransaction">
          <h3 class="text-center text-title text-bold">Enter your password</h3>
          <div class="form-group mt-5 mb-4">
            <label class="form-label">Password</label>
            <AppInput
              v-model="userPassword"
              size="small"
              data-testid="input-password-transaction"
              type="password"
              :filled="true"
            />
          </div>
          <hr class="separator my-5" />
          <div class="flex-between-centered gap-4">
            <AppButton color="borderless" type="button" @click="isSignModalShown = false"
              >Cancel</AppButton
            >
            <AppButton
              color="primary"
              data-testid="button-password-continue"
              :loading="isSigning"
              :disabled="userPassword.length === 0 || isSigning"
              type="submit"
              >Continue</AppButton
            >
          </div>
        </form>
      </div>
    </AppModal>
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
    <!-- Executed modal -->
    <AppModal
      v-model:show="isExecutedModalShown"
      data-testid="modal-transaction-success"
      class="transaction-success-modal"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isExecutedModalShown = false"></i>
        </div>
        <div class="text-center">
          <i class="bi bi-check-lg large-icon" data-testid="icon-success-checkmark"></i>
        </div>
        <h3 class="text-center text-title text-bold mt-5"><slot name="successHeading"></slot></h3>
        <p
          class="d-flex justify-content-between align-items text-center text-small text-secondary mt-4"
        >
          <span class="text-bold text-secondary">Transaction ID:</span>
          <a
            data-testid="a-transaction-id"
            class="link-primary cursor-pointer"
            @click="
              network.network !== 'custom' &&
                openExternal(`
            https://hashscan.io/${network.network}/transaction/${transactionResult?.response.transactionId}`)
            "
            >{{ transactionResult?.response.transactionId }}</a
          >
        </p>
        <slot name="successContent"></slot>

        <hr class="separator my-5" />

        <div class="d-grid">
          <AppButton
            color="primary"
            data-testid="button-close-completed-tx"
            @click="
              () => {
                isExecutedModalShown = false;
                onCloseSuccessModalClick && onCloseSuccessModalClick();
              }
            "
            >Close</AppButton
          >
        </div>
      </div>
    </AppModal>
  </div>
</template>
