<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';

import {
  FileAppendTransaction,
  FileUpdateTransaction,
  Transaction,
  TransactionReceipt,
  TransactionResponse,
} from '@hashgraph/sdk';
import { Transaction as Tx } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';

import {
  TRANSACTION_MAX_SIZE,
  TRANSACTION_SIGNATURE_ESTIMATED_MAX_SIZE,
} from '@main/shared/constants';

import {
  execute,
  createTransactionId,
  storeTransaction,
  signTransaction,
} from '@renderer/services/transactionService';
import { openExternal } from '@renderer/services/electronUtilsService';
import { getDollarAmount } from '@renderer/services/mirrorNodeDataService';

import { getTransactionType } from '@renderer/utils/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Props */
const props = defineProps<{
  transactionBytes: Uint8Array | null;
  onExecuted?: (
    response: TransactionResponse,
    receipt: TransactionReceipt,
    chunksAmount?: number,
  ) => void;
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
} | null>();
const chunksAmount = ref<number | null>(null);
const chunkSize = ref(1024);
const chunkInterval = ref(0.1);
const userPassword = ref('');
const requiredSignatures = ref<string[]>([]);
const isConfirmShown = ref(false);
const isSigning = ref(false);
const isSignModalShown = ref(false);
const isChunkingModalShown = ref(false);
const processedChunks = ref(0);
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
    console.log('Send to back end along with required external signatures');
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

    const signedTransaction = Transaction.fromBytes(signedTransactionBytes);

    if (
      signedTransaction instanceof FileUpdateTransaction ||
      signedTransaction instanceof FileAppendTransaction
    ) {
      if (
        signedTransactionBytes.length > TRANSACTION_MAX_SIZE &&
        signedTransaction.contents !== null
      ) {
        isChunkingModalShown.value = true;
        const chunks = chunkBuffer(signedTransaction.contents, chunkSize.value);
        isChunkingModalShown.value = false;

        if (user.data.mode === 'personal') {
          await executeFileTransactions(signedTransaction, chunks);
        } else {
          const chunkedTransactions = await chunkFileTransactionForOrganization(
            signedTransaction,
            chunks,
          );
          await sendSignedChunksToOrganization(chunkedTransactions);
        }
      } else if (user.data.mode === 'personal') {
        await executeTransaction(signedTransactionBytes);
      } else if (user.data.mode === 'organization') {
        await sendSignedTransactionToOrganization(signedTransactionBytes);
        console.log('Send to back end signed along with required', externalPublicKeysReq.value);
      }
    } else {
      throw new Error('Transaction is not File Update or Append Transaction');
    }
  } catch (err: any) {
    toast.error(err.message || 'Transaction signing failed', { position: 'bottom-right' });
  } finally {
    isSigning.value = false;
  }
}

/* Functions */
async function process(
  _requiredSignatures: string[],
  _chunkSize?: number,
  _chunkInterval?: number,
) {
  resetData();
  requiredSignatures.value = [...new Set(_requiredSignatures)];

  await nextTick();
  await keyPairs.refetch();

  validateProcess();

  const estimatedSignaturesSize =
    _requiredSignatures.length * TRANSACTION_SIGNATURE_ESTIMATED_MAX_SIZE;

  if (_chunkSize) {
    _chunkSize = Number(_chunkSize);
    if (_chunkSize < 1024) chunkSize.value = 1024;
    else if (_chunkSize + estimatedSignaturesSize > TRANSACTION_MAX_SIZE)
      throw new Error('Chunk too large, transaction max size could be exceeded');
    else chunkSize.value = _chunkSize;
  }
  if (_chunkInterval) {
    _chunkInterval = Number(_chunkInterval);
    if (_chunkInterval <= 0) chunkInterval.value = 0.1;
    else chunkInterval.value = _chunkInterval;
  }
  await nextTick();

  const sizeWithoutSignatures = transaction.value!.toBytes().length;
  const estimatedTransactionSize = sizeWithoutSignatures + estimatedSignaturesSize;

  chunksAmount.value =
    estimatedTransactionSize >= TRANSACTION_MAX_SIZE
      ? Math.ceil(estimatedTransactionSize / chunkSize.value)
      : null;

  isConfirmShown.value = true;

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

async function executeTransaction(transactionBytes: Uint8Array) {
  await nextTick();
  if (!transaction.value) {
    throw new Error('Transaction is not provided');
  }

  let status = 0;

  try {
    isExecuting.value = true;

    const { response, receipt } = await execute(transactionBytes);
    transactionResult.value = { response, receipt };

    status = transactionResult.value.receipt.status._code;

    isExecutedModalShown.value = true;
    props.onExecuted && props.onExecuted(response, receipt);

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

  if (!type.value || !transaction.value.transactionId) throw new Error('Cannot save transaction');

  const transactionToStore: Tx = {
    id: '',
    name: `${type.value} (${transaction.value.transactionId.toString()})`,
    type: type.value,
    description: '',
    transaction_id: transaction.value.transactionId.toString(),
    transaction_hash: (await transaction.value.getTransactionHash()).toString(),
    body: transaction.value.toBytes().toString(),
    status: '',
    status_code: status,
    user_id: user.data.id,
    creator_public_key: null,
    signature: '',
    valid_start: transaction.value.transactionId.validStart?.toString() || '',
    executed_at: new Date().getTime() / 1000,
    created_at: new Date(),
    updated_at: new Date(),
    group_id: null,
  };
  await storeTransaction(transactionToStore);
}

async function sendSignedTransactionToOrganization(transactionBytes: Uint8Array) {
  console.log(transactionBytes);
  console.log('Send to back end signed along with required', externalPublicKeysReq.value);
}

async function chunkFileTransactionForOrganization(
  transaction: FileUpdateTransaction | FileAppendTransaction,
  chunks: Uint8Array[],
) {
  if (!transaction.contents) return [transaction.toBytes()];
  validateTransaction(transaction);

  const transactions: Uint8Array[] = [];
  const isUpdateTransaction = transaction instanceof FileUpdateTransaction;

  isChunkingModalShown.value = true;
  processedChunks.value = 0;

  if (isUpdateTransaction) {
    const updateTransaction = new FileUpdateTransaction()
      .setTransactionId(transaction.transactionId!)
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(transaction.maxTransactionFee || 2)
      .setFileId(transaction.fileId!)
      .setContents(chunks[0]);
    transaction.fileMemo && updateTransaction.setFileMemo(transaction.fileMemo);
    transaction.keys && transaction.keys.length > 0 && updateTransaction.setKeys(transaction.keys);
    transaction.expirationTime && updateTransaction.setExpirationTime(transaction.expirationTime);

    transactions[0] = await signTransaction(
      updateTransaction.toBytes(),
      localPublicKeysReq.value,
      user.data.id,
      userPassword.value,
    );

    processedChunks.value++;
  }

  for (let i = isUpdateTransaction ? 1 : 0; i < chunks.length; i++) {
    if (!transaction.transactionId) throw new Error('Transaction ID is missing');
    if (!transaction.transactionId.accountId)
      throw new Error('Account ID in Transaction ID is missing');

    const transactionId = createTransactionId(
      transaction.transactionId.accountId,
      transaction.transactionId.validStart?.plusNanos(i * chunkInterval.value * 1000000000) ||
        new Date(),
    );

    const appendTransaction = new FileAppendTransaction()
      .setTransactionId(transactionId)
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(transaction.maxTransactionFee || 2)
      .setFileId(transaction.fileId!)
      .setContents(chunks[i])
      .setMaxChunks(1)
      .setChunkSize(chunkSize.value);

    transactions.push(
      await signTransaction(
        appendTransaction.toBytes(),
        localPublicKeysReq.value,
        user.data.id,
        userPassword.value,
      ),
    );

    processedChunks.value++;
  }

  isChunkingModalShown.value = false;

  return transactions;
}

async function executeFileTransactions(
  transaction: FileUpdateTransaction | FileAppendTransaction,
  chunks: Uint8Array[],
) {
  isExecuting.value = true;
  let firstTransactionResult: {
    response: TransactionResponse;
    receipt: TransactionReceipt;
  } | null = null;
  processedChunks.value = 0;
  let hasFailed = false;
  const group = transaction.transactionId?.validStart?.seconds.toString() || '';

  validateTransaction(transaction);

  for (let i = 0; i < chunks.length; i++) {
    if (hasFailed) {
      isExecuting.value = false;
      return;
    }

    let status = 0;
    let chunkTransaction: FileUpdateTransaction | FileAppendTransaction = transaction;
    let chunkTransactionType = '';

    let executionResult: {
      response: TransactionResponse;
      receipt: TransactionReceipt;
    } | null = null;

    try {
      if (transaction instanceof FileUpdateTransaction && i === 0) {
        chunkTransactionType = 'File Update Transaction';
        chunkTransaction = new FileUpdateTransaction()
          .setTransactionId(createTransactionId(transaction.transactionId!.accountId!, new Date()))
          .setTransactionValidDuration(180)
          .setMaxTransactionFee(transaction.maxTransactionFee || 2)
          .setFileId(transaction.fileId!)
          .setContents(chunks[0]);
        transaction.fileMemo && chunkTransaction.setFileMemo(transaction.fileMemo);
        transaction.keys &&
          transaction.keys.length > 0 &&
          chunkTransaction.setKeys(transaction.keys);
        transaction.expirationTime &&
          chunkTransaction.setExpirationTime(transaction.expirationTime);
      } else {
        chunkTransactionType = 'File Append Transaction';
        chunkTransaction = new FileAppendTransaction()
          .setTransactionId(createTransactionId(transaction.transactionId!.accountId!, new Date()))
          .setTransactionValidDuration(180)
          .setMaxTransactionFee(transaction.maxTransactionFee || 2)
          .setFileId(transaction.fileId!)
          .setContents(chunks[i])
          .setMaxChunks(1)
          .setChunkSize(chunkSize.value);
      }

      const signedTransactionBytes = await signTransaction(
        chunkTransaction.toBytes(),
        localPublicKeysReq.value,
        user.data.id,
        userPassword.value,
      );

      const { response, receipt } = await execute(signedTransactionBytes);

      if (i === 0) firstTransactionResult = { response, receipt };
      executionResult = { response, receipt };

      status = receipt.status._code;

      processedChunks.value++;
    } catch (error: any) {
      console.log(error);
      hasFailed = true;

      let message = error.message;
      try {
        const data = JSON.parse(error.message);
        status = data.status;
        message = data.message;
      } catch {
        /* empty */
      }

      toast.error(message, { position: 'bottom-right' });
    }

    if (chunkTransaction === null || !executionResult) {
      throw new Error('No transaction to save');
    }

    const transactionToStore: Tx = {
      id: '',
      name: `${chunkTransactionType} (${chunkTransaction.transactionId?.toString()})`,
      type: chunkTransactionType,
      description: '',
      transaction_id: chunkTransaction.transactionId?.toString() || '',
      transaction_hash: executionResult.response.toString(),
      body: chunkTransaction.toBytes().toString(),
      status: '',
      status_code: status,
      user_id: user.data.id,
      creator_public_key: null,
      signature: '',
      valid_start: chunkTransaction.transactionId?.validStart?.toString() || '',
      executed_at: new Date().getTime() / 1000,
      created_at: new Date(),
      updated_at: new Date(),
      group_id: group,
    };

    await storeTransaction(transactionToStore);
  }

  isExecuting.value = false;

  if (firstTransactionResult) {
    transactionResult.value = firstTransactionResult;
    props.onExecuted &&
      props.onExecuted(
        firstTransactionResult.response,
        firstTransactionResult.receipt,
        chunksAmount.value || undefined,
      );
    isExecutedModalShown.value = true;
  }

  if (unmounted.value) {
    toast.success('Transaction executed', { position: 'bottom-right' });
  }
}

async function sendSignedChunksToOrganization(transactions: Uint8Array[]) {
  console.log(transactions);
  console.log('Send to back end signed along with required', externalPublicKeysReq.value);
}

function validateTransaction(transaction: FileUpdateTransaction | FileAppendTransaction) {
  if (!transaction.transactionId) throw new Error('Transaction ID is missing');
  if (!transaction.fileId) throw new Error('Transaction file ID is missing');
}

function chunkBuffer(buffer: Uint8Array, chunkSize: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < buffer.length; i += chunkSize) {
    chunks.push(buffer.slice(i, i + chunkSize));
  }
  return chunks;
}

function resetData() {
  userPassword.value = '';
  transactionResult.value = null;
  isSigning.value = false;
  isExecuting.value = false;
  isExecutedModalShown.value = false;
  isChunkingModalShown.value = false;
  isSignModalShown.value = false;
  requiredSignatures.value = [];
  chunksAmount.value = null;
  chunkSize.value = 1024;
  chunkInterval.value = 0.1;
  processedChunks.value = 0;
}

/* Hooks */
onBeforeUnmount(() => (unmounted.value = true));

/* Expose */
defineExpose({
  transactionResult,
  chunksAmount,
  process,
});
</script>
<template>
  <div>
    <!-- Confirm modal -->
    <AppModal
      class="large=modal"
      v-model:show="isConfirmShown"
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
              class="d-flex justify-content-between p-3 mt-3"
              v-if="transaction?.maxTransactionFee"
            >
              <p>Max Transaction Fee</p>
              <p class="">
                {{ transaction?.maxTransactionFee }} ({{
                  getDollarAmount(network.currentRate, transaction.maxTransactionFee.toBigNumber())
                }})
              </p>
            </div>
            <div v-if="chunksAmount" class="d-flex justify-content-between p-3 mt-3">
              <p>Estimated Chunks</p>
              <p class="text-secondary">{{ chunksAmount }}</p>
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
      class="common-modal"
      v-model:show="isSignModalShown"
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
        <form @submit="handleSignTransaction" class="mt-3">
          <h3 class="text-center text-title text-bold">Enter your password</h3>
          <div class="form-group mt-5 mb-4">
            <label class="form-label">Password</label>
            <AppInput size="small" v-model="userPassword" type="password" :filled="true" />
          </div>
          <p v-if="chunksAmount" class="text-small mb-3">Estimated chunks: {{ chunksAmount }}</p>
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
    <!-- Chunking modal -->
    <AppModal
      class="common-modal"
      v-model:show="isChunkingModalShown"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isChunkingModalShown = false"></i>
        </div>
        <div class="text-center">
          <AppLoader />
        </div>
        <h3 class="text-center text-title text-bold mt-5">Chunking {{ type }}</h3>
        <p class="text-center text-small text-secondary mt-4" v-if="chunksAmount">
          {{ processedChunks }} out of {{ chunksAmount }}
        </p>
      </div>
    </AppModal>
    <!-- Executing modal -->
    <AppModal
      class="common-modal"
      v-model:show="isExecuting"
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
          <p class="text-center text-small text-secondary" v-if="chunksAmount">
            {{ processedChunks }} out of {{ chunksAmount }}
          </p>
          <AppButton color="primary" class="mt-1" @click="isExecuting = false">Close</AppButton>
        </div>
      </div>
    </AppModal>
    <!-- Executed modal -->
    <AppModal
      class="transaction-success-modal"
      v-model:show="isExecutedModalShown"
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
