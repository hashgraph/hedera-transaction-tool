<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces/organization/approvers';
import type { GroupItem } from '@renderer/stores/storeTransactionGroup';
import type { ApiGroupItem, IGroup } from '@renderer/services/organization';

import { computed, nextTick, onBeforeUnmount, ref } from 'vue';

import { Key, KeyList, Transaction, TransactionReceipt, TransactionResponse } from '@hashgraph/sdk';
import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useToast } from 'vue-toast-notification';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { execute, signTransaction, storeTransaction } from '@renderer/services/transactionService';
import { decryptPrivateKey, flattenKeyList } from '@renderer/services/keyPairService';
import { deleteDraft } from '@renderer/services/transactionDraftsService';
import { addGroupItem, editGroupItem } from '@renderer/services/transactionGroupsService';
import { addGroup, getGroupItem } from '@renderer/services/transactionGroupsService';
import {
  addApprovers,
  addObservers,
  submitTransactionGroup,
  getTransactionGroupById,
} from '@renderer/services/organization';

import { createTransactionId } from '@renderer/utils/sdk';

import {
  assertUserLoggedIn,
  ableToSign,
  getPrivateKey,
  getStatusFromCode,
  uint8ToHex,
  isLoggedInOrganization,
  isUserLoggedIn,
  getErrorMessage,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import { getTransactionType } from '@renderer/utils/sdk/transactions';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Props */
const props = defineProps<{
  observers?: number[];
  approvers?: TransactionApproverDto[];
  onExecuted?: (id: string) => void;
  onSubmitted?: (id: number, transactionBytes: string) => void;
  onCloseSuccessModalClick?: () => void;
  watchExecutedModalShown?: (shown: boolean) => void;
}>();

/* Emits */
defineEmits<{
  (event: 'abort'): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const transactionGroup = useTransactionGroupStore();

/* Composables */
const toast = useToast();
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const transactionResult = ref<{
  response: TransactionResponse;
  receipt: TransactionReceipt;
} | null>();
const signatureKey = ref<Key | KeyList | null>(null);
const isConfirmShown = ref(false);
const isSigning = ref(false);
const isSignModalShown = ref(false);
const isExecuting = ref(false);
const isExecutedModalShown = ref(false);
const unmounted = ref(false);
const newGroupId = ref('');

/* Computed */
const flattenedSignatureKey = computed(() =>
  signatureKey.value ? flattenKeyList(signatureKey.value).map(pk => pk.toStringRaw()) : [],
);
const localPublicKeysReq = computed(() =>
  flattenedSignatureKey.value.filter(pk => user.publicKeys.includes(pk)),
);

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
    await sendSignedTransactionsToOrganization();
  } else if (localPublicKeysReq.value.length > 0) {
    await signAfterConfirm();
  } else {
    throw new Error(
      'Unable to execute, all of the required signatures should be with your keys. You are currently in Personal mode.',
    );
  }
}

async function signAfterConfirm() {
  if (!transactionGroup.groupItems) {
    throw new Error('Transaction not provided');
  }

  assertUserLoggedIn(user.personal);

  /* Verifies the user has entered his password */
  const personalPassword = getPassword(signAfterConfirm, {
    subHeading: 'Enter your application password to sign the transaction',
  });
  if (passwordModalOpened(personalPassword)) return;

  try {
    isConfirmShown.value = true;
    isSigning.value = true;

    for (const groupItem of transactionGroup.groupItems) {
      const signedTransactionBytes = await signTransaction(
        groupItem.transactionBytes,
        localPublicKeysReq.value,
        user.personal.id,
        personalPassword,
      );
      isConfirmShown.value = false;

      await executeTransaction(signedTransactionBytes, groupItem);
    }
  } catch (error) {
    toast.error(getErrorMessage(error, 'Transaction signing failed'), errorToastOptions);
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
      toast.success('Transaction executed', successToastOptions);
    }
  } catch (error) {
    const data = JSON.parse(getErrorMessage(error, 'Transaction execution failed'));
    status = data.status;

    toast.error(data.message, errorToastOptions);
  } finally {
    isExecuting.value = false;
  }

  const executedTransaction = Transaction.fromBytes(transactionBytes);

  const type = getTransactionType(executedTransaction);

  if (!type || !executedTransaction.transactionId) throw new Error('Cannot save transaction');

  if (!newGroupId.value) {
    const newGroup = await addGroup(
      transactionGroup.description,
      false,
      transactionGroup.groupValidStart,
    );
    newGroupId.value = newGroup.id;
  }

  const tx: Prisma.TransactionUncheckedCreateInput = {
    name: `${type} (${executedTransaction.transactionId.toString()})`,
    type: type,
    description: '',
    transaction_id: executedTransaction.transactionId.toString(),
    transaction_hash: (await executedTransaction.getTransactionHash()).toString(),
    body: transactionBytes.toString(),
    status: getStatusFromCode(status)!,
    status_code: status,
    user_id: user.personal.id,
    creator_public_key: null,
    signature: '',
    valid_start: executedTransaction.transactionId.validStart?.toString() || '',
    executed_at: new Date().getTime() / 1000,
    network: network.network,
    group_id: !groupItem?.groupId ? newGroupId.value : groupItem.groupId,
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
    await addGroupItem(groupItem, newGroupId.value, storedTransaction.id);
  }

  props.onExecuted && props.onExecuted(storedTransaction.id);
}

async function sendSignedTransactionsToOrganization() {
  isConfirmShown.value = false;

  /* Verifies the user is logged in organization */
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    throw new Error('Please select an organization');
  }

  /* Verifies the user has entered his password */
  assertUserLoggedIn(user.personal);
  const personalPassword = getPassword(sendSignedTransactionsToOrganization, {
    subHeading: 'Enter your application password to sign as a creator',
  });
  if (passwordModalOpened(personalPassword)) return;

  /* Verifies the user has at least one key pair */
  if (user.keyPairs.length == 0) {
    throw new Error("You don't have any key pair. Please add one and retry.");
  }

  /* Verifies there is actual transaction to process */
  if (!transactionGroup.groupItems[0].transactionBytes) throw new Error('No Transactions provided');

  /* User Serializes each Transaction */
  const groupBytesHex = new Array<string>();
  for (const groupItem of transactionGroup.groupItems) {
    groupBytesHex.push(uint8ToHex(groupItem.transactionBytes));
  }

  /* Signs the unfrozen transaction */
  const keyToSignWith = user.keyPairs[0].public_key;

  const privateKeyRaw = await decryptPrivateKey(user.personal.id, personalPassword, keyToSignWith);
  const privateKey = getPrivateKey(keyToSignWith, privateKeyRaw);

  const groupSignatureHex = new Array<string>();
  for (const groupItem of transactionGroup.groupItems) {
    groupSignatureHex.push(uint8ToHex(privateKey.sign(groupItem.transactionBytes)));
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
        transactionBytes: groupBytesHex[i],
        mirrorNetwork: network.network,
        signature: groupSignatureHex[i],
        creatorKeyId:
          user.selectedOrganization.userKeys.find(k => k.publicKey === keyToSignWith)?.id || -1,
      },
    });
  }

  const { id, transactionBytes } = await submitTransactionGroup(
    user.selectedOrganization.serverUrl,
    transactionGroup.description,
    false,
    transactionGroup.sequential,
    apiGroupItems,
  );

  const group: IGroup = await getTransactionGroupById(user.selectedOrganization.serverUrl, id, false);

  toast.success('Transaction submitted successfully', successToastOptions);

  for (const groupItem of group.groupItems) {
    const results = await Promise.allSettled([
      // uploadSignatures(body, id),
      uploadObservers(groupItem.transaction.id, groupItem.seq),
      uploadApprovers(groupItem.transaction.id, groupItem.seq),
      deleteDraftsIfNotTemplate(),
    ]);
    results.forEach(result => {
      if (result.status === 'rejected') {
        toast.error(result.reason.message, errorToastOptions);
      }
    });
  }
  props.onSubmitted && props.onSubmitted(id, transactionBytes);
}

async function uploadObservers(transactionId: number, seqId: number) {
  const hasObservers = transactionGroup.hasObservers(seqId);

  if (!hasObservers) {
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
  const hasApprovers = transactionGroup.hasApprovers(seqId);

  if (!hasApprovers) {
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

function resetData() {
  transactionResult.value = null;
  isSigning.value = false;
  isExecuting.value = false;
  isExecutedModalShown.value = false;
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
      class="large-modal"
      :close-on-click-outside="false"
      :close-on-escape="false"
      scrollable
    >
      <template #header>
        <div class="d-flex flex-column w-100">
          <div>
            <i
              class="bi bi-x-lg cursor-pointer"
              @click="((isConfirmShown = false), $emit('abort'))"
            ></i>
          </div>
          <div class="text-center">
            <i class="bi bi-arrow-left-right large-icon"></i>
          </div>
          <h3 class="text-center text-title text-bold mt-5">Confirm Transaction Group</h3>
          <hr class="separator my-5" />
        </div>
      </template>
      <template #default>
        <div
          v-for="(groupItem, index) in transactionGroup.groupItems"
          :key="groupItem.transactionBytes.toString()"
          class="px-5"
        >
          <div class="d-flex p-4 transaction-group-row justify-content-between">
            <div>{{ getTransactionType(groupItem.transactionBytes) }}</div>
            <div :data-testid="'div-transaction-id-' + index">
              {{
                groupItem.description != ''
                  ? groupItem.description
                  : Transaction.fromBytes(groupItem.transactionBytes).transactionMemo
                    ? Transaction.fromBytes(groupItem.transactionBytes).transactionMemo
                    : createTransactionId(groupItem.payerAccountId, groupItem.validStart)
              }}
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <hr class="separator m-5" />

        <div class="flex-between-centered gap-4 w-100 px-5 pb-5">
          <AppButton
            type="button"
            color="borderless"
            @click="((isConfirmShown = false), $emit('abort'))"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            data-testid="button-confirm-group-transaction"
            type="button"
            @click.prevent="handleConfirmTransaction"
            >Confirm</AppButton
          >
        </div>
      </template>
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
