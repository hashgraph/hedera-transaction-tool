<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';

import { Key, KeyList, Transaction, TransactionReceipt, TransactionResponse } from '@hashgraph/sdk';
import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';

import { execute, signTransaction, storeTransaction } from '@renderer/services/transactionService';
import { openExternal } from '@renderer/services/electronUtilsService';
import { getDollarAmount } from '@renderer/services/mirrorNodeDataService';
import { flattenKeyList } from '@renderer/services/keyPairService';
import { deleteDraft, getDraft } from '@renderer/services/transactionDraftsService';

import { getStatusFromCode, getTransactionType } from '@renderer/utils/transactions';
import { ableToSign } from '@renderer/utils/sdk';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Props */
const props = defineProps<{
  transactionBytes: Uint8Array | null;
  onExecuted?: (response: TransactionResponse, receipt: TransactionReceipt) => void;
  onCloseSuccessModalClick?: () => void;
  watchExecutedModalShown?: (shown: boolean) => void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const keyPairs = useKeyPairsStore();

/* Composables */
const toast = useToast();
const route = useRoute();

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
const externalPublicKeysReq = computed(() =>
  flattenedSignatureKey.value.filter(pk => !keyPairs.publicKeys.includes(pk)),
);
const localPublicKeysReq = computed(() =>
  flattenedSignatureKey.value.filter(pk => keyPairs.publicKeys.includes(pk)),
);
const type = computed(() => transaction.value && getTransactionType(transaction.value));

/* Handlers */
function handleConfirmTransaction(e: Event) {
  e.preventDefault();

  // Personal user:
  //  with all local keys -> Execute
  //  with local and external -> FAIL
  //  without local keys but external -> FAIL
  // Organization user:
  //  with all local -> Execute
  //  with local and external -> SIGN AND SEND
  //  without local but external -> SEND

  if (localPublicKeysReq.value.length > 0) {
    isConfirmShown.value = false;
    isSignModalShown.value = true;
  } else if (user.data.mode === 'organization') {
    console.log('Send to back end along with siganture key');
  }
}

async function handleSignTransaction(e: Event) {
  e.preventDefault();

  if (!props.transactionBytes) throw new Error('Transaction not provided');

  try {
    isSigning.value = true;

    const signedTransactionBytes = await signTransaction(
      props.transactionBytes,
      localPublicKeysReq.value,
      user.data.id,
      userPassword.value,
    );

    isSignModalShown.value = false;

    if (user.data.mode === 'personal') {
      await executeTransaction(signedTransactionBytes);
    } else if (user.data.mode === 'organization') {
      await sendSignedTransactionToOrganization();
      console.log('Send to back end signed along with required', signatureKey.value);
    }
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
  await keyPairs.refetch();

  validateProcess();

  await nextTick();

  isConfirmShown.value = true;

  function validateProcess() {
    if (!transaction.value) {
      throw new Error('Transaction not provided');
    }

    if (!user.data.isLoggedIn) {
      throw new Error('User is not logged in');
    }

    if (
      signatureKey.value &&
      !ableToSign(keyPairs.publicKeys, signatureKey.value) &&
      user.data.mode === 'personal'
    ) {
      throw new Error(
        'Unable to execute, all of the required signatures should be with your keys. You are currently in Personal mode.',
      );
    }
  }
}

async function executeTransaction(transactionBytes: Uint8Array) {
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
    user_id: user.data.id,
    creator_public_key: null,
    signature: '',
    valid_start: executedTransaction.transactionId.validStart?.toString() || '',
    executed_at: new Date().getTime() / 1000,
    group_id: null,
  };

  await storeTransaction(tx);
}

async function sendSignedTransactionToOrganization() {
  console.log('Send to back end signed along with required', externalPublicKeysReq.value);
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
              <p>{{ type }}</p>
            </div>
            <div class="d-flex justify-content-between p-3 mt-3">
              <p>Transaction ID</p>
              <p class="text-secondary">{{ transaction?.transactionId }}</p>
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
              <p class="">
                {{ transaction?.maxTransactionFee }} ({{
                  getDollarAmount(network.currentRate, transaction.maxTransactionFee.toBigNumber())
                }})
              </p>
            </div>
          </div>

          <hr class="separator my-5" />

          <div class="d-flex justify-content-between">
            <AppButton type="button" color="secondary" @click="isConfirmShown = false"
              >Cancel</AppButton
            >
            <AppButton color="primary" type="submit">Sign</AppButton>
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
            <AppInput v-model="userPassword" size="small" type="password" :filled="true" />
          </div>
          <hr class="separator" />
          <div class="row mt-4">
            <div class="col-6">
              <AppButton
                color="secondary"
                type="button"
                class="w-100"
                @click="isSignModalShown = false"
                >Cancel</AppButton
              >
            </div>
            <div class="col-6">
              <AppButton
                color="primary"
                :loading="isSigning"
                :disabled="userPassword.length === 0 || isSigning"
                class="w-100"
                type="submit"
                >Continue</AppButton
              >
            </div>
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
        <div class="d-grid mt-4">
          <AppButton color="primary" class="mt-1" @click="isExecuting = false">Close</AppButton>
        </div>
      </div>
    </AppModal>
    <!-- Executed modal -->
    <AppModal
      v-model:show="isExecutedModalShown"
      class="transaction-success-modal"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isExecutedModalShown = false"></i>
        </div>
        <div class="text-center">
          <i class="bi bi-check-lg large-icon"></i>
        </div>
        <h3 class="text-center text-title text-bold mt-5"><slot name="successHeading"></slot></h3>
        <p
          class="d-flex justify-content-between align-items text-center text-small text-secondary mt-4"
        >
          <span class="text-bold text-secondary">Transaction ID:</span>
          <a
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
        <div class="d-grid mt-5">
          <AppButton
            color="primary"
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
