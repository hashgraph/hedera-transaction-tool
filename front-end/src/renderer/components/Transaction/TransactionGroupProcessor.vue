<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, inject } from 'vue';

import {
  FileAppendTransaction,
  FileUpdateTransaction,
  Hbar,
  Key,
  KeyList,
  Transaction,
  TransactionReceipt,
  TransactionResponse,
} from '@hashgraph/sdk';
import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';

import {
  createTransactionId,
  execute,
  signTransaction,
  storeTransaction,
} from '@renderer/services/transactionService';
import { decryptPrivateKey, flattenKeyList } from '@renderer/services/keyPairService';
import { deleteDraft, getDraft } from '@renderer/services/transactionDraftsService';

import { USER_PASSWORD_MODAL_KEY, USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import { ableToSign, getPrivateKey, getStatusFromCode, getTransactionType } from '@renderer/utils';
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
import useTransactionGroupStore, { GroupItem } from '@renderer/stores/storeTransactionGroup';
import { TRANSACTION_MAX_SIZE } from '@main/shared/constants';
import { addGroupItem, editGroupItem } from '@renderer/services/transactionGroupsService';
import { addGroup, getGroupItem } from '@renderer/services/transactionGroupsService';
import { uint8ArrayToHex } from '@renderer/services/electronUtilsService';
import {
  submitTransaction,
  addApprovers,
  addObservers,
  ApiTransaction,
  ApiGroupItem,
  submitTransactionGroup,
  getTransactionsToSign,
} from '@renderer/services/organization';
import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

/* Props */
const props = defineProps<{
  observers?: number[];
  approvers?: TransactionApproverDto[];
  onExecuted?: (
    response: TransactionResponse,
    receipt: TransactionReceipt,
    chunksAmount?: number,
  ) => void;
  onSubmitted?: (id: number, body: string) => void;
  onCloseSuccessModalClick?: () => void;
  watchExecutedModalShown?: (shown: boolean) => void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const transactionGroup = useTransactionGroupStore();

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
const chunksAmount = ref<number | null>(null);
const chunkSize = ref(1024);
const chunkInterval = ref(0.1);
const userPassword = ref('');
const signatureKey = ref<Key | KeyList | null>(null);
const isConfirmShown = ref(false);
const isSigning = ref(false);
const isSignModalShown = ref(false);
const isChunkingModalShown = ref(false);
const processedChunks = ref(0);
const isExecuting = ref(false);
const isExecutedModalShown = ref(false);
const unmounted = ref(false);
const newGroupId = ref('');

/* Computed */
// const transaction = computed(() =>
//   props.transactionBytes ? Transaction.fromBytes(props.transactionBytes) : null,
// );
const flattenedSignatureKey = computed(() =>
  signatureKey.value ? flattenKeyList(signatureKey.value).map(pk => pk.toStringRaw()) : [],
);
const externalPublicKeysReq = computed(() =>
  flattenedSignatureKey.value.filter(pk => !user.publicKeys.includes(pk)),
);
const localPublicKeysReq = computed(() =>
  flattenedSignatureKey.value.filter(pk => user.publicKeys.includes(pk)),
);
// const type = computed(() => transaction.value && getTransactionType(transaction.value));

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

  // if (user.selectedOrganization) {
  //   await sendSignedTransactionToOrganization();
  // } else if (localPublicKeysReq.value.length > 0) {
  //   isConfirmShown.value = false;
  //   isSignModalShown.value = true;
  // } else {
  //   throw new Error(
  //     'Unable to execute, all of the required signatures should be with your keys. You are currently in Personal mode.',
  //   );
  // }

  if (user.selectedOrganization) {
    await sendSignedTransactionsToOrganization();
  } else if (localPublicKeysReq.value.length > 0) {
    isConfirmShown.value = false;
    isSignModalShown.value = true;
  } else {
    throw new Error(
      'Unable to execute, all of the required signatures should be with your keys. You are currently in Personal mode.',
    );
  }
}

async function handleSignTransactions() {
  if (!transactionGroup.groupItems) {
    throw new Error('Transaction not provided');
  }

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

    for (const groupItem of transactionGroup.groupItems) {
      const signedTransactionBytes = await signTransaction(
        groupItem.transactionBytes,
        localPublicKeysReq.value,
        user.personal.id,
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

          if (!user.selectedOrganization) {
            await executeFileTransactions(signedTransaction, chunks);
          }
        } else if (!user.selectedOrganization) {
          await executeTransaction(signedTransactionBytes, groupItem);
        }
      } else {
        await executeTransaction(signedTransactionBytes, groupItem);
        console.log('transaction completed execution');
      }
    }
  } catch (err: any) {
    toast.error(err.message || 'Transaction signing failed', { position: 'bottom-right' });
  } finally {
    isSigning.value = false;
  }
}

/* Functions */
async function process(requiredKey: Key) {
  // Should fix to work without nextTicks if possible
  resetData();
  signatureKey.value = requiredKey;

  await nextTick();
  await user.refetchKeys();

  validateProcess();

  await nextTick();

  isConfirmShown.value = true;
}

function validateProcess() {
  if (!transactionGroup.groupItems) {
    throw new Error('Transaction Group not provided');
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

async function executeTransaction(transactionBytes: Uint8Array, groupItem?: GroupItem) {
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

    // props.onExecuted && props.onExecuted(response, receipt);

    // if (route.query.draftId) {
    //   try {
    //     const draft = await getDraft(route.query.draftId.toString());

    //     if (!draft.isTemplate) {
    //       await deleteDraft(route.query.draftId.toString());
    //     }
    //   } catch (error) {
    //     console.log(error);
    //   }
    // }

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

  const type = getTransactionType(executedTransaction);

  if (!type || !executedTransaction.transactionId) throw new Error('Cannot save transaction');

  const tx: Prisma.TransactionUncheckedCreateInput = {
    name: `${type} (${executedTransaction.transactionId.toString()})`,
    type: type,
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
    network: network.network,
  };

  const storedTransaction = await storeTransaction(tx);

  if (groupItem?.groupId != undefined) {
    const savedGroupItem = await getGroupItem(groupItem.groupId, groupItem.seq);
    await editGroupItem({
      transaction_id: storedTransaction.id,
      transaction_group_id: groupItem.groupId,
      transaction_draft_id: null,
      seq: groupItem.seq,
    });
    await deleteDraft(savedGroupItem.transaction_draft_id!);
  } else if (groupItem) {
    if (newGroupId.value === '') {
      const newGroup = await addGroup('', false);
      newGroupId.value = newGroup.id;
    }
    await addGroupItem(groupItem, newGroupId.value, storedTransaction.id);
  }
  // Modify transaction group items using transactionGroup.groupId and transactionGroup.seq and storedTransaction.id
  // Delete drafts
}

async function sendSignedTransactionsToOrganization() {
  isConfirmShown.value = false;

  /* Verifies the user is logged in organization */
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    throw new Error('Please select an organization');
  }

  /* Verifies the user has entered his password */
  if (!isLoggedInWithPassword(user.personal)) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    userPasswordModalRef.value?.open(
      'Enter your application password',
      'Enter your application password to sign as a creator',
      sendSignedTransactionsToOrganization,
    );
    return;
  }

  /* Verifies there is actual transaction to process */
  if (!transactionGroup.groupItems[0].transactionBytes) throw new Error('No Transactions provided');

  /* User Serializes each Transaction */
  const groupBytesHex = new Array<string>();
  for (const groupItem of transactionGroup.groupItems) {
    groupBytesHex.push(await uint8ArrayToHex(groupItem.transactionBytes));
  }

  /* Signs the unfrozen transaction */
  const keyToSignWith = user.keyPairs[0].public_key;

  const privateKeyRaw = await decryptPrivateKey(
    user.personal.id,
    user.personal.password,
    keyToSignWith,
  );
  const privateKey = getPrivateKey(keyToSignWith, privateKeyRaw);

  const groupSignatureHex = new Array<string>();
  for (const groupItem of transactionGroup.groupItems) {
    groupSignatureHex.push(await uint8ArrayToHex(privateKey.sign(groupItem.transactionBytes)));
  }

  /* Submit transactions to the back end */
  const apiGroupItems = new Array<ApiGroupItem>();
  for (const [i, groupItem] of transactionGroup.groupItems.entries()) {
    const transaction = Transaction.fromBytes(groupItem.transactionBytes);
    apiGroupItems.push({
      seq: i,
      transaction: {
        name: transaction.transactionMemo || `New ${getTransactionType(transaction)}`,
        description: transaction.transactionMemo || '',
        body: groupBytesHex[i],
        network: network.network,
        signature: groupSignatureHex[i],
        creatorKeyId:
          user.selectedOrganization.userKeys.find(k => k.publicKey === keyToSignWith)?.id || -1,
      },
    });
  }

  const { id, body } = await submitTransactionGroup(
    user.selectedOrganization.serverUrl,
    transactionGroup.description,
    false,
    apiGroupItems,
  );

  //TODO: fix to getting actual transactions
  const transactions = await getTransactionsToSign(
    user.selectedOrganization.serverUrl,
    network.network,
    1,
    10,
  );

  const newTransactions = new Array<number>();

  for (const [i, transaction] of transactions.items.entries()) {
    if (
      transaction.transaction.groupItem.groupId == id &&
      transaction.transaction.groupItem.seq == i
    ) {
      newTransactions.push(transaction.transaction.id);
    }
  }

  console.log(newTransactions);

  toast.success('Transaction submitted successfully');
  props.onSubmitted && props.onSubmitted(id, body);

  //TODO: should be per transaction ID, not group ID
  for (const [i, groupItem] of transactionGroup.groupItems.entries()) {
    const results = await Promise.allSettled([
      // uploadSignatures(body, id),
      uploadObservers(newTransactions[i], parseInt(groupItem.seq)),
      uploadApprovers(newTransactions[i], parseInt(groupItem.seq)),
      deleteDraftsIfNotTemplate(),
    ]);
    results.forEach(result => {
      if (result.status === 'rejected') {
        toast.error(result.reason.message);
      }
    });
  }
}

async function uploadObservers(transactionId: number, seqId: number) {
  if (
    !transactionGroup.groupItems[seqId].observers ||
    transactionGroup.groupItems[seqId].observers.length === 0
  ) {
    return;
  }

  if (!isLoggedInOrganization(user.selectedOrganization))
    throw new Error('User is not logged in organization');

  await addObservers(
    user.selectedOrganization.serverUrl,
    transactionId,
    transactionGroup.groupItems[seqId].observers,
  );
}

async function uploadApprovers(transactionId: number, seqId: number) {
  if (
    !transactionGroup.groupItems[seqId].approvers ||
    transactionGroup.groupItems[seqId].approvers.length === 0
  ) {
    return;
  }

  if (!isLoggedInOrganization(user.selectedOrganization))
    throw new Error('User is not logged in organization');

  await addApprovers(
    user.selectedOrganization.serverUrl,
    transactionId,
    transactionGroup.groupItems[seqId].approvers,
  );
}

async function deleteDraftsIfNotTemplate() {
  // TODO
  /* Delete if draft and not template */
  // if (route.query.draftId) {
  //   try {
  //     const draft = await getDraft(route.query.draftId.toString());
  //     if (!draft.isTemplate) await deleteDraft(route.query.draftId.toString());
  //   } catch (error) {
  //     console.log(error);
  //   }
  // }
}

async function executeFileTransactions(
  transaction: FileUpdateTransaction | FileAppendTransaction,
  chunks: Uint8Array[],
) {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

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

    let transactionHash: Uint8Array | null = null;

    try {
      if (transaction instanceof FileUpdateTransaction && i === 0) {
        chunkTransactionType = 'File Update Transaction';
        chunkTransaction = new FileUpdateTransaction()
          .setTransactionId(createTransactionId(transaction.transactionId!.accountId!, new Date()))
          .setTransactionValidDuration(180)
          .setMaxTransactionFee(transaction.maxTransactionFee || new Hbar(2))
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
        const newValidStart = new Date();
        newValidStart.setSeconds(0);

        chunkTransaction = new FileAppendTransaction()
          .setTransactionId(
            createTransactionId(transaction.transactionId!.accountId!, newValidStart),
          )
          .setTransactionValidDuration(180)
          .setMaxTransactionFee(transaction.maxTransactionFee || new Hbar(2))
          .setFileId(transaction.fileId!)
          .setContents(chunks[i])
          .setMaxChunks(1)
          .setChunkSize(chunkSize.value);
      }

      const signedTransactionBytes = await signTransaction(
        chunkTransaction.toBytes(),
        localPublicKeysReq.value,
        user.personal.id,
        userPassword.value,
      );

      const executedTransaction = Transaction.fromBytes(signedTransactionBytes);
      transactionHash = await executedTransaction.getTransactionHash();

      const { response, receipt } = await execute(signedTransactionBytes);

      if (i === 0) firstTransactionResult = { response, receipt };

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

    if (chunkTransaction === null || !transactionHash) {
      throw new Error('No transaction to save');
    }

    const transactionToStore: Prisma.TransactionUncheckedCreateInput = {
      name: `${chunkTransactionType} (${chunkTransaction.transactionId?.toString()})`,
      type: chunkTransactionType,
      description: '',
      transaction_id: chunkTransaction.transactionId?.toString() || '',
      transaction_hash: transactionHash.toString(),
      body: chunkTransaction.toBytes().toString(),
      status: getStatusFromCode(status),
      status_code: status,
      user_id: user.personal.id,
      creator_public_key: null,
      signature: '',
      valid_start: chunkTransaction.transactionId?.validStart?.toString() || '',
      executed_at: new Date().getTime() / 1000,
      network: network.network,
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
}

async function chunkFileTransactionForOrganization(
  transaction: FileUpdateTransaction | FileAppendTransaction,
  chunks: Uint8Array[],
) {
  if (!transaction.contents) return [transaction.toBytes()];

  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  validateTransaction(transaction);

  const transactions: Uint8Array[] = [];
  const isUpdateTransaction = transaction instanceof FileUpdateTransaction;

  isChunkingModalShown.value = true;
  processedChunks.value = 0;

  if (isUpdateTransaction) {
    const updateTransaction = new FileUpdateTransaction()
      .setTransactionId(transaction.transactionId!)
      .setTransactionValidDuration(180)
      .setMaxTransactionFee(transaction.maxTransactionFee || new Hbar(2))
      .setFileId(transaction.fileId!)
      .setContents(chunks[0]);
    transaction.fileMemo && updateTransaction.setFileMemo(transaction.fileMemo);
    transaction.keys && transaction.keys.length > 0 && updateTransaction.setKeys(transaction.keys);
    transaction.expirationTime && updateTransaction.setExpirationTime(transaction.expirationTime);

    transactions[0] = await signTransaction(
      updateTransaction.toBytes(),
      localPublicKeysReq.value,
      user.personal.id,
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
      .setMaxTransactionFee(transaction.maxTransactionFee || new Hbar(2))
      .setFileId(transaction.fileId!)
      .setContents(chunks[i])
      .setMaxChunks(1)
      .setChunkSize(chunkSize.value);

    transactions.push(
      await signTransaction(
        appendTransaction.toBytes(),
        localPublicKeysReq.value,
        user.personal.id,
        userPassword.value,
      ),
    );

    processedChunks.value++;
  }

  isChunkingModalShown.value = false;

  return transactions;
}

async function sendSignedFileTransactionToOrganization(transactionBytes?: Uint8Array) {
  console.log(transactionBytes);
  console.log('Send to back end signed along with required', externalPublicKeysReq.value);
}

// async function sendSignedTransactionToOrganization() {
//   isConfirmShown.value = false;

//   /* Verifies the user is logged in organization */
//   if (!isLoggedInOrganization(user.selectedOrganization)) {
//     throw new Error('Please select an organization');
//   }

//   /* Verifies the user has entered his password */
//   if (!isLoggedInWithPassword(user.personal)) {
//     if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
//     userPasswordModalRef.value?.open(
//       'Enter your personal account password',
//       'Enter your personal to sign as a creator',
//       sendSignedTransactionToOrganization,
//     );
//     return;
//   }

//   /* Verifies there is actual transaction to process */
//   if (!props.transactionBytes) throw new Error('Transaction not provided');

//   /* User Serializes the Transaction */
//   const hexTransactionBytes = await uint8ArrayToHex(props.transactionBytes);

//   /* Signs the unfrozen transaction */
//   const keyToSignWith = user.keyPairs[0].public_key;

//   const privateKeyRaw = await decryptPrivateKey(
//     user.personal.id,
//     user.personal.password,
//     keyToSignWith,
//   );
//   const privateKey = getPrivateKey(keyToSignWith, privateKeyRaw);

//   const signature = privateKey.sign(props.transactionBytes);
//   const signatureHex = await uint8ArrayToHex(signature);

//   /* Submit the transaction to the back end */
//   const { id, body } = await submitTransaction(
//     user.selectedOrganization.serverUrl,
//     transaction.value?.transactionMemo || `New ${type.value}`,
//     transaction.value?.transactionMemo || '',
//     hexTransactionBytes,
//     signatureHex,
//     user.selectedOrganization.userKeys.find(k => k.publicKey === keyToSignWith)?.id || -1,
//   );

//   toast.success('Transaction submitted successfully');
//   props.onSubmitted && props.onSubmitted(id, body);

//   const bodyBytes = await hexToUint8Array(body);

//   /* Delete if draft and not template */
//   if (route.query.draftId) {
//     try {
//       const draft = await getDraft(route.query.draftId.toString());
//       if (!draft.isTemplate) await deleteDraft(route.query.draftId.toString());
//     } catch (error) {
//       console.log(error);
//     }
//   }

//   /* Deserialize the transaction */
//   const sdkTransaction = Transaction.fromBytes(bodyBytes);

//   /* Check if should sign */
//   const publicKeysRequired = await publicRequiredToSign(
//     sdkTransaction,
//     user.selectedOrganization.userKeys,
//     network.mirrorNodeBaseURL,
//   );
//   if (publicKeysRequired.length === 0) return;

//   await fullUploadSignatures(
//     user.personal,
//     user.selectedOrganization,
//     publicKeysRequired,
//     sdkTransaction,
//     id,
//   );

//   toast.success('Transaction signed successfully');
// }

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
        <h3 class="text-center text-title text-bold mt-5">Confirm Transaction Group</h3>
        <hr class="separator my-5" />
        <div
          v-for="(groupItem, index) in transactionGroup.groupItems"
          :key="groupItem.transactionBytes.toString()"
        >
          <div class="d-flex p-4" style="background-color: #edefff">
            <div>{{ index + 1 }}</div>
            <div>{{ groupItem.type }}</div>
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton type="button" color="borderless" @click="isConfirmShown = false"
            >Cancel</AppButton
          >
          <AppButton color="primary" type="button" @click="handleConfirmTransaction"
            >Sign All</AppButton
          >
        </div>
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
        <form class="mt-3" @submit.prevent="handleSignTransactions">
          <h3 class="text-center text-title text-bold">Enter your password</h3>
          <div class="form-group mt-5 mb-4">
            <label class="form-label">Password</label>
            <AppInput v-model="userPassword" size="small" type="password" :filled="true" />
          </div>
          <hr class="separator my-5" />
          <div class="flex-between-centered gap-4">
            <AppButton color="borderless" type="button" @click="isSignModalShown = false"
              >Cancel</AppButton
            >
            <AppButton
              color="primary"
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
        <h3 class="text-center text-title text-bold mt-5">Executing Group</h3>
        <hr class="separator my-5" />

        <div class="d-grid">
          <AppButton color="primary" @click="isExecuting = false">Close</AppButton>
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
        <!-- <p
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
        </p> -->
        <slot name="successContent"></slot>

        <hr class="separator my-5" />

        <div class="d-grid">
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
