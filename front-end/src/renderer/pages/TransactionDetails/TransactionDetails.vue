<script setup lang="ts">
import type { Transaction } from '@prisma/client';
import type { ITransactionFull } from '@main/shared/interfaces';

import { computed, onBeforeMount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import { TransactionStatus } from '@main/shared/interfaces';
import { TRANSACTION_ACTION } from '@main/shared/constants';
import { CommonNetwork } from '@main/shared/enums';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useContactsStore from '@renderer/stores/storeContacts';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useNextTransactionStore from '@renderer/stores/storeNextTransaction';

import { useToast } from 'vue-toast-notification';
import useDisposableWs from '@renderer/composables/useDisposableWs';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import {
  cancelTransaction,
  getTransactionById,
  getUserShouldApprove,
  sendApproverChoice,
  uploadSignatureMap,
} from '@renderer/services/organization';
import { getTransaction } from '@renderer/services/transactionService';
import { decryptPrivateKey } from '@renderer/services/keyPairService';

import {
  getTransactionDateExtended,
  getTransactionId,
  getTransactionPayerId,
  getTransactionType,
} from '@renderer/utils/sdk/transactions';
import {
  getDateStringExtended,
  getPrivateKey,
  getTransactionBodySignatureWithoutNodeAccountId,
  getUInt8ArrayFromBytesString,
  KEEP_NEXT_QUERY_KEY,
  openTransactionInHashscan,
  redirectToDetails,
  hexToUint8Array,
  isLoggedInOrganization,
  isUserLoggedIn,
  computeSignatureKey,
  publicRequiredToSign,
  getErrorMessage,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppStepper from '@renderer/components/ui/AppStepper.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import SignatureStatus from '@renderer/components/SignatureStatus.vue';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ReadOnlyApproversList from '@renderer/components/Approvers/ReadOnlyApproversList.vue';

import txTypeComponentMapping from '@renderer/components/Transaction/Details/txTypeComponentMapping';

/* Stores */
const user = useUserStore();
const network = useNetwork();
const contacts = useContactsStore();
const wsStore = useWebsocketConnection();
const nextTransaction = useNextTransactionStore();

/* Composables */
const router = useRouter();
const toast = useToast();
const ws = useDisposableWs();
const { getPassword, passwordModalOpened } = usePersonalPassword();
useSetDynamicLayout(LOGGED_IN_LAYOUT);

/* State */
const orgTransaction = ref<ITransactionFull | null>(null);
const localTransaction = ref<Transaction | null>(null);
const sdkTransaction = ref<SDKTransaction | null>(null);
const signatureKeyObject = ref<Awaited<ReturnType<typeof computeSignatureKey>> | null>(null);
const publicKeysRequiredToSign = ref<string[] | null>(null);
const shouldApprove = ref<boolean>(false);
const isConfirmModalShown = ref(false);
const confirmModalTitle = ref('');
const confirmModalText = ref('');
const confirmModalButtonText = ref('');
const confirmCallback = ref<((...args: any[]) => void) | null>(null);
const isSigning = ref(false);
const isApproving = ref(false);
const isConfirmModalLoadingState = ref(false);
const confirmModalLoadingText = ref('');
const nextId = ref<string | number | null>(null);

/* Computed */
const stepperItems = computed(() => {
  if (!orgTransaction.value) return [];

  const items: {
    title: string;
    name: string;
    bubbleClass?: string;
    bubbleLabel?: string;
    bubbleIcon?: string;
  }[] = [
    { title: 'Transaction Created', name: 'Transaction Created' },
    { title: 'Collecting Signatures', name: 'Collecting Signatures' },
    { title: 'Awaiting Execution', name: 'Awaiting Execution' },
  ];

  if (
    [TransactionStatus.EXPIRED, TransactionStatus.CANCELED].includes(orgTransaction.value.status)
  ) {
    items.push({
      title: orgTransaction.value.status === TransactionStatus.EXPIRED ? 'Expired' : 'Canceled',
      name: orgTransaction.value.status === TransactionStatus.EXPIRED ? 'Expired' : 'Canceled',
      bubbleClass: 'bg-danger text-white',
      bubbleIcon: 'x-lg',
    });
    items[0].bubbleIcon = 'check-lg';
    items[1].bubbleIcon = 'check-lg';
    items.splice(2, 1);
  } else items.push({ title: 'Executed', name: 'Executed' });

  return items;
});

const stepperActiveIndex = computed(() => {
  switch (orgTransaction.value?.status) {
    case TransactionStatus.NEW:
      return 0;
    case TransactionStatus.WAITING_FOR_SIGNATURES:
      return 1;
    case TransactionStatus.WAITING_FOR_EXECUTION:
      return 2;
    case TransactionStatus.EXECUTED:
    case TransactionStatus.FAILED:
      return 3;
    default:
      return -1;
  }
});

const transactionSpecificLabel = computed(() => {
  if (!sdkTransaction.value || !(sdkTransaction.value instanceof SDKTransaction))
    return 'Transaction Specific Details';

  const type = getTransactionType(sdkTransaction.value, true).toLocaleLowerCase();

  if (type.includes('accountcreate')) return 'Account Creation Info';
  if (type.includes('accountupdate')) return 'Account Changes';
  if (type.includes('accountdelete')) return 'Account Deletion Info';
  if (type.includes('accountallowanceapprove')) return 'Allowance Approval Info';
  if (type.includes('fileappend')) return 'File Append Info';
  if (type.includes('filecreate')) return 'File Creation Info';
  if (type.includes('fileupdate')) return 'File Changes';
  if (type.includes('freeze')) return 'Freeze Information';
  if (type.includes('transfer')) return 'Transfer Info';
  if (type.includes('systemdelete')) return 'System Delete Info';
  if (type.includes('systemundelete')) return 'System Undelete Info';
  if (type.includes('nodecreate')) return 'Node Creation Info';
  if (type.includes('nodeupdate')) return 'Node Update Info';
  if (type.includes('nodedelete')) return 'Node Deletion Info';

  return 'Transaction Specific Details';
});

const signersPublicKeys = computed(() => {
  if (!orgTransaction.value || !orgTransaction.value.signers) return [];

  return orgTransaction.value.signers.map(signer => signer.userKey.publicKey);
});

const creator = computed(() => {
  return orgTransaction.value
    ? contacts.contacts.find(contact =>
        contact.userKeys.some(k => k.id === orgTransaction.value?.creatorKeyId),
      )
    : null;
});

const transactionIsInProgress = computed(
  () =>
    orgTransaction.value &&
    [
      TransactionStatus.NEW,
      TransactionStatus.WAITING_FOR_EXECUTION,
      TransactionStatus.WAITING_FOR_SIGNATURES,
    ].includes(orgTransaction.value.status),
);

const canCancel = computed(() => {
  if (!orgTransaction.value || !creator.value) return false;
  if (!isLoggedInOrganization(user.selectedOrganization)) return false;

  const userIsCreator = creator.value.user.id === user.selectedOrganization.userId;
  return userIsCreator && transactionIsInProgress.value;
});

const canSign = computed(() => {
  if (!orgTransaction.value || !publicKeysRequiredToSign.value) return false;
  if (!isLoggedInOrganization(user.selectedOrganization)) return false;

  const userShouldSign = publicKeysRequiredToSign.value.length > 0;

  return userShouldSign && transactionIsInProgress.value;
});

/* Handlers */
const handleBack = () => {
  if (
    !history.state?.back?.startsWith('/transactions') &&
    !history.state?.back?.startsWith('/transaction-group/')
  ) {
    router.push({ name: 'transactions' });
  } else {
    router.back();
  }
};

const handleSign = async () => {
  if (
    !sdkTransaction.value ||
    !(sdkTransaction.value instanceof SDKTransaction) ||
    !orgTransaction.value
  ) {
    throw new Error('Transaction is not available');
  }

  if (!isLoggedInOrganization(user.selectedOrganization) || !isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in organization');
  }

  const personalPassword = getPassword(handleSign, {
    subHeading: 'Enter your application password to access your private key',
  });
  if (passwordModalOpened(personalPassword)) return;

  try {
    isSigning.value = true;

    const publicKeysRequired = await publicRequiredToSign(
      sdkTransaction.value,
      user.selectedOrganization.userKeys,
      network.mirrorNodeBaseURL,
    );

    const restoredRequiredKeys = [];
    const requiredNonRestoredKeys = [];

    for (const requiredKey of publicKeysRequired) {
      if (user.keyPairs.some(k => k.public_key === requiredKey)) {
        restoredRequiredKeys.push(requiredKey);
      } else {
        requiredNonRestoredKeys.push(requiredKey);
      }
    }

    if (requiredNonRestoredKeys.length > 0) {
      toast.error(
        `You need to restore the following public keys to fully sign the transaction: ${requiredNonRestoredKeys.join(
          ', ',
        )}`,
      );
    }

    if (restoredRequiredKeys.length > 0) {
      await uploadSignatureMap(
        user.personal.id,
        personalPassword,
        user.selectedOrganization,
        restoredRequiredKeys,
        SDKTransaction.fromBytes(sdkTransaction.value.toBytes()),
        orgTransaction.value.id,
      );
      toast.success('Transaction signed successfully');
    }
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to sign transaction'));
  } finally {
    isSigning.value = false;
  }
};

const handleApprove = async (approved: boolean, showModal?: boolean) => {
  if (!approved && showModal) {
    confirmModalTitle.value = 'Reject Transaction?';
    confirmModalText.value = 'Are you sure you want to reject the transaction?';
    confirmModalButtonText.value = 'Reject';
    confirmCallback.value = () => handleApprove(false);
    confirmModalLoadingText.value = 'Rejecting...';
    isConfirmModalShown.value = true;
    return;
  }

  const callback = async () => {
    if (
      !sdkTransaction.value ||
      !(sdkTransaction.value instanceof SDKTransaction) ||
      !orgTransaction.value
    ) {
      throw new Error('Transaction is not available');
    }

    if (!isLoggedInOrganization(user.selectedOrganization) || !isUserLoggedIn(user.personal)) {
      throw new Error('User is not logged in organization');
    }

    const personalPassword = getPassword(callback, {
      subHeading: 'Enter your application password to access your private key',
    });
    if (passwordModalOpened(personalPassword)) return;

    try {
      if (approved) {
        isApproving.value = true;
      } else {
        isConfirmModalLoadingState.value = true;
      }

      const publicKey = user.selectedOrganization.userKeys[0].publicKey;
      const privateKeyRaw = await decryptPrivateKey(user.personal.id, personalPassword, publicKey);
      const privateKey = getPrivateKey(publicKey, privateKeyRaw);

      const signature = getTransactionBodySignatureWithoutNodeAccountId(
        privateKey,
        sdkTransaction.value,
      );

      await sendApproverChoice(
        user.selectedOrganization.serverUrl,
        orgTransaction.value.id,
        user.selectedOrganization.userKeys[0].id,
        signature,
        approved,
      );
      toast.success(`Transaction ${approved ? 'approved' : 'rejected'} successfully`);

      if (!approved) {
        router.back();
      }
    } catch (error) {
      isConfirmModalShown.value = false;
      throw error;
    } finally {
      isApproving.value = false;
      isConfirmModalLoadingState.value = false;
      confirmModalLoadingText.value = '';
    }
  };

  await callback();
};

const handleCancel = async (showModal?: boolean) => {
  if (!orgTransaction.value) {
    throw new Error('Transaction is not available');
  }

  if (showModal) {
    confirmModalTitle.value = 'Cancel Transaction?';
    confirmModalText.value = 'Are you sure you want to cancel the transaction?';
    confirmModalButtonText.value = 'Confirm';
    confirmCallback.value = () => handleCancel();
    isConfirmModalShown.value = true;
    return;
  }

  if (!isLoggedInOrganization(user.selectedOrganization) || !isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in organization');
  }

  try {
    confirmModalLoadingText.value = 'Canceling...';
    isConfirmModalLoadingState.value = true;
    await cancelTransaction(user.selectedOrganization.serverUrl, orgTransaction.value.id);
    toast.success(`Transaction canceled successfully`);
  } catch (error) {
    isConfirmModalShown.value = false;
    throw error;
  } finally {
    isConfirmModalLoadingState.value = false;
    confirmModalLoadingText.value = '';
  }

  router.back();
};

const handleNext = () => {
  if (!nextId.value) return;

  const newPreviousTransactionsIds = [...(nextTransaction.previousTransactionsIds || [])];
  if (isLoggedInOrganization(user.selectedOrganization)) {
    orgTransaction.value && newPreviousTransactionsIds.push(orgTransaction.value.id);
  } else {
    localTransaction.value && newPreviousTransactionsIds.push(localTransaction.value.id);
  }
  nextTransaction.setPreviousTransactionsIds(newPreviousTransactionsIds);

  redirectToDetails(router, nextId.value.toString(), true, true);
};

const handleSubmit = async (e: Event) => {
  e.preventDefault();

  const buttonContent = (e as SubmitEvent).submitter?.textContent || '';

  if ([reject, approve].includes(buttonContent)) {
    await handleApprove(buttonContent === approve, true);
  } else if (buttonContent === sign) {
    await handleSign();
  } else if (buttonContent === next) {
    await handleNext();
  } else if (buttonContent === cancel) {
    await handleCancel(true);
  }
};

/* Functions */
async function fetchTransaction(id: string | number) {
  let transactionBytes: Uint8Array;
  if (isLoggedInOrganization(user.selectedOrganization) && !isNaN(Number(id))) {
    try {
      orgTransaction.value = await getTransactionById(
        user.selectedOrganization?.serverUrl || '',
        Number(id),
      );
      transactionBytes = hexToUint8Array(orgTransaction.value.transactionBytes);
      publicKeysRequiredToSign.value = await publicRequiredToSign(
        SDKTransaction.fromBytes(transactionBytes),
        user.selectedOrganization.userKeys,
        network.mirrorNodeBaseURL,
      );
      shouldApprove.value = await getUserShouldApprove(
        user.selectedOrganization.serverUrl,
        orgTransaction.value.id,
      );
    } catch (error) {
      router.previousPath ? router.back() : router.push({ name: 'transactions' });
      throw error;
    }
  } else {
    try {
      localTransaction.value = await getTransaction(id.toString());
      transactionBytes = getUInt8ArrayFromBytesString(localTransaction.value.body);
      publicKeysRequiredToSign.value = null;
    } catch (error) {
      router.previousPath ? router.back() : router.push({ name: 'transactions' });
      throw error;
    }
  }

  try {
    sdkTransaction.value = SDKTransaction.fromBytes(transactionBytes);
  } catch {
    throw new Error('Failed to deserialize transaction');
  }

  if (!sdkTransaction.value || !(sdkTransaction.value instanceof SDKTransaction)) {
    router.back();
    return;
  }

  if (isLoggedInOrganization(user.selectedOrganization)) {
    signatureKeyObject.value = await computeSignatureKey(
      sdkTransaction.value,
      network.mirrorNodeBaseURL,
    );
  }
}

const subscribeToTransactionAction = () => {
  if (!user.selectedOrganization?.serverUrl) return;
  ws.on(user.selectedOrganization?.serverUrl, TRANSACTION_ACTION, async () => {
    const id = router.currentRoute.value.params.id;
    const formattedId = Array.isArray(id) ? id[0] : id;
    await fetchTransaction(formattedId);
    nextId.value = await nextTransaction.getNext(
      isLoggedInOrganization(user.selectedOrganization) ? Number(formattedId) : formattedId,
    );
  });
};

/* Hooks */
onBeforeMount(async () => {
  const id = router.currentRoute.value.params.id;

  if (!id) {
    router.back();
    return;
  }

  const keepNextTransaction = router.currentRoute.value.query[KEEP_NEXT_QUERY_KEY];
  if (!keepNextTransaction) nextTransaction.reset();

  subscribeToTransactionAction();
  const formattedId = Array.isArray(id) ? id[0] : id;

  const result = await Promise.all([
    fetchTransaction(formattedId),
    nextTransaction.getNext(
      isLoggedInOrganization(user.selectedOrganization) ? Number(formattedId) : formattedId,
    ),
  ]);
  nextId.value = result[1];
});

/* Watchers */
wsStore.$onAction(ctx => {
  if (ctx.name !== 'setup') return;
  ctx.after(() => subscribeToTransactionAction());
});

watch(
  () => user.selectedOrganization,
  () => {
    router.back();
  },
);

/* Misc */
const sectionHeadingClass = 'd-flex justify-content-between align-items-center';
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small mt-1 text-break';
const reject = 'Reject';
const approve = 'Approve';
const sign = 'Sign';
const next = 'Next';
const cancel = 'Cancel';
</script>
<template>
  <div class="p-5">
    <div class="flex-column-100 overflow-hidden">
      <Transition name="fade" mode="out-in">
        <template
          v-if="
            (!orgTransaction && !localTransaction) ||
            !sdkTransaction ||
            !(sdkTransaction instanceof SDKTransaction)
          "
        >
          <div class="flex-column-100 justify-content-center">
            <div>
              <AppButton
                color="secondary"
                class="min-w-unset"
                @click="handleBack"
                data-testid="button-back"
              >
                <i class="bi bi-arrow-left-short text-main"></i> Back</AppButton
              >
            </div>
            <div class="flex-column-100 justify-content-center">
              <AppLoader class="mb-7" />
            </div>
          </div>
        </template>
        <template v-else>
          <form @submit="handleSubmit" class="flex-column-100">
            <!-- Header -->
            <div class="flex-centered justify-content-between flex-wrap gap-4">
              <div class="d-flex align-items-center">
                <AppButton
                  type="button"
                  color="secondary"
                  class="btn-icon-only me-4"
                  data-testid="button-back"
                  @click="handleBack"
                >
                  <i class="bi bi-arrow-left"></i>
                </AppButton>

                <h2 class="text-title text-bold">Transaction Details</h2>
              </div>
              <div class="flex-centered gap-4">
                <div v-if="canCancel">
                  <AppButton color="secondary" type="submit" class="me-3">{{ cancel }}</AppButton>
                </div>
                <div v-if="isLoggedInOrganization(user.selectedOrganization) && shouldApprove">
                  <AppButton color="secondary" type="submit" class="me-3">{{ reject }}</AppButton>
                  <AppButton
                    color="primary"
                    type="submit"
                    :disabled="isApproving"
                    :loading="isApproving"
                    loading-text="Approving..."
                    >{{ approve }}</AppButton
                  >
                </div>
                <div v-else-if="canSign">
                  <AppButton
                    color="primary"
                    data-testid="button-sign-org-transaction"
                    type="submit"
                    :disabled="isSigning"
                    :loading="isSigning"
                    loading-text="Signing..."
                    >{{ sign }}</AppButton
                  >
                </div>
                <div v-else-if="nextId">
                  <AppButton
                    color="primary"
                    data-testid="button-next-org-transaction"
                    type="submit"
                    >{{ next }}</AppButton
                  >
                </div>
              </div>
            </div>

            <div class="fill-remaining mt-5 pe-4">
              <div class="row flex-wrap">
                <!-- Description -->
                <div :class="'col-11'">
                  <div
                    v-if="
                      (
                        orgTransaction?.description.trim() ||
                        localTransaction?.description.trim() ||
                        ''
                      ).length > 0
                    "
                  >
                    <h4 :class="detailItemLabelClass">Description</h4>
                    <p :class="detailItemValueClass" data-testid="p-description-field">
                      {{ orgTransaction?.description || localTransaction?.description }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Transaction Status -->
              <div v-if="orgTransaction" class="mt-5">
                <h4 :class="detailItemLabelClass">Transaction Status</h4>
                <AppStepper
                  :items="stepperItems"
                  :active-index="
                    stepperActiveIndex === stepperItems.length - 1
                      ? stepperActiveIndex + 1
                      : stepperActiveIndex
                  "
                />
              </div>

              <!-- Approvers -->
              <div
                v-if="orgTransaction?.approvers && orgTransaction?.approvers.length > 0"
                class="mt-5"
              >
                <h4 class="text-title text-bold">Approvers</h4>
                <ReadOnlyApproversList :approvers="orgTransaction?.approvers" />
              </div>

              <hr v-if="isLoggedInOrganization(user.selectedOrganization)" class="separator my-8" />

              <!-- CREATION DETAILS -->
              <h2 class="text-title text-bold mt-5">Creation Details</h2>

              <div class="row flex-wrap mt-5">
                <!-- Creator -->
                <template v-if="creator">
                  <div :class="commonColClass">
                    <h4 :class="detailItemLabelClass">Creator</h4>
                    <p :class="detailItemValueClass">
                      {{ creator?.user?.email }}
                      <span v-if="creator?.nickname?.trim().length > 0" class="text-pink"
                        >({{ creator?.nickname?.trim() }})</span
                      >
                    </p>
                  </div>
                </template>

                <!-- Transaction Created -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Created at</h4>
                  <p :class="detailItemValueClass" data-testid="p-transaction-details-created-at">
                    {{
                      getDateStringExtended(
                        new Date(
                          orgTransaction?.createdAt || localTransaction?.created_at || Date.now(),
                        ),
                      )
                    }}
                  </p>
                </div>

                <!-- Transaction Executed -->
                <div
                  v-if="orgTransaction?.executedAt || localTransaction?.executed_at"
                  :class="commonColClass"
                >
                  <h4 :class="detailItemLabelClass">Executed at</h4>
                  <p :class="detailItemValueClass" data-testid="p-transaction-details-executed_at">
                    {{
                      getDateStringExtended(
                        new Date(
                          orgTransaction?.executedAt || localTransaction?.executed_at || Date.now(),
                        ),
                      )
                    }}
                  </p>
                </div>
              </div>

              <hr class="separator my-5" />

              <!-- TRANSACTION GENERAL DETAILS -->
              <div :class="sectionHeadingClass">
                <h2 class="text-title text-bold">Transaction Details</h2>
                <span
                  v-if="
                    [
                      CommonNetwork.MAINNET,
                      CommonNetwork.TESTNET,
                      CommonNetwork.PREVIEWNET,
                    ].includes(network.network) &&
                    (localTransaction || stepperActiveIndex === stepperItems.length - 1)
                  "
                  class="text-micro text-pink cursor-pointer"
                  @click="
                    openTransactionInHashscan(
                      sdkTransaction.transactionId?.toString() || '',
                      network.network,
                    )
                  "
                  >View in hashscan</span
                >
              </div>

              <!-- General Transaction Information -->
              <div class="mt-5 row flex-wrap">
                <!-- Transaction Type -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Type</h4>
                  <p :class="detailItemValueClass" data-testid="p-transaction-details-type">
                    {{ getTransactionType(sdkTransaction) }}
                  </p>
                </div>

                <!-- Transaction ID -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Transaction ID</h4>
                  <p :class="detailItemValueClass" data-testid="p-transaction-details-id">
                    {{ getTransactionId(sdkTransaction) }}
                  </p>
                </div>

                <!-- Transaction Valid Start -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Valid Start</h4>
                  <p :class="detailItemValueClass" data-testid="p-transaction-details-valid-start">
                    {{ getTransactionDateExtended(sdkTransaction) }}
                  </p>
                </div>

                <!-- Transaction Fee Payer -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Fee Payer</h4>
                  <p :class="detailItemValueClass" data-testid="p-transaction-details-fee-payer">
                    {{ getTransactionPayerId(sdkTransaction) }}
                  </p>
                </div>
              </div>

              <!-- Transaction Memo -->
              <div v-if="sdkTransaction.transactionMemo" class="mt-5">
                <h4 :class="detailItemLabelClass">Transaction Memo</h4>
                <p :class="detailItemValueClass" data-testid="p-transaction-details-memo">
                  {{ sdkTransaction.transactionMemo }}
                </p>
              </div>

              <hr class="separator my-5" />

              <!-- TRANSACTION SPECIFIC DETAILS -->
              <h2 class="text-title text-bold">{{ transactionSpecificLabel }}</h2>

              <!-- Transaction Specific Component -->
              <Component
                :is="txTypeComponentMapping[getTransactionType(sdkTransaction, true)]"
                :transaction="sdkTransaction"
                :organization-transaction="orgTransaction"
              />

              <hr class="separator my-5" />

              <!-- SIGNATURES COLLECTED -->
              <h2 v-if="signatureKeyObject" class="text-title text-bold">Signatures Collected</h2>
              <div v-if="signatureKeyObject" class="text-small mt-5">
                <SignatureStatus
                  :signature-key-object="signatureKeyObject"
                  :public-keys-signed="signersPublicKeys"
                />
              </div>

              <hr
                v-if="orgTransaction?.observers && orgTransaction.observers.length > 0"
                class="separator my-5"
              />

              <!-- Observers -->
              <div
                v-if="orgTransaction?.observers && orgTransaction.observers.length > 0"
                class="mt-5"
              >
                <h4 class="text-title text-bold">Observers</h4>
                <UsersGroup
                  :addable="false"
                  :editable="false"
                  :userIds="orgTransaction.observers.map(o => o.userId)"
                />
              </div>
            </div>
          </form>
        </template>
      </Transition>
    </div>
    <AppModal v-model:show="isConfirmModalShown" class="common-modal">
      <div class="p-4">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          @click="isConfirmModalShown = false"
        ></i>
        <div class="text-center">
          <AppCustomIcon :name="'questionMark'" style="height: 160px" />
        </div>
        <h3 class="text-center text-title text-bold mt-4">{{ confirmModalTitle }}</h3>
        <p class="text-center text-small text-secondary mt-4">
          {{ confirmModalText }}
        </p>
        <hr class="separator my-5" />
        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" @click="isConfirmModalShown = false">Cancel</AppButton>
          <AppButton
            color="primary"
            data-testid="button-confirm-change-password"
            @click="confirmCallback && confirmCallback()"
            :disabled="isConfirmModalLoadingState"
            :loading="isConfirmModalLoadingState"
            :loading-text="confirmModalLoadingText"
            >{{ confirmModalButtonText }}</AppButton
          >
        </div>
      </div>
    </AppModal>
  </div>
</template>
