<script setup lang="ts">
import { computed, inject, onBeforeMount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Transaction as SDKTransaction } from '@hashgraph/sdk';
import { Transaction } from '@prisma/client';

import { ITransactionFull, TransactionStatus } from '@main/shared/interfaces';
import { TRANSACTION_ACTION } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useContactsStore from '@renderer/stores/storeContacts';

import { useToast } from 'vue-toast-notification';
import useDisposableWs from '@renderer/composables/useDisposableWs';
import useSetDynamicLayout from '@renderer/composables/useSetDynamicLayout';

import {
  cancelTransaction,
  fullUploadSignatures,
  getTransactionById,
  getUserShouldApprove,
  sendApproverChoice,
} from '@renderer/services/organization';
import { getTransaction } from '@renderer/services/transactionService';
import { hexToUint8Array } from '@renderer/services/electronUtilsService';
import { decryptPrivateKey } from '@renderer/services/keyPairService';

import { USER_PASSWORD_MODAL_KEY, USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import {
  isLoggedInOrganization,
  isLoggedInWithValidPassword,
  isUserLoggedIn,
} from '@renderer/utils/userStoreHelpers';
import {
  getTransactionDateExtended,
  getTransactionId,
  getTransactionPayerId,
  getTransactionType,
} from '@renderer/utils/sdk/transactions';
import {
  computeSignatureKey,
  publicRequiredToSign,
} from '@renderer/utils/transactionSignatureModels';
import {
  getDateStringExtended,
  getPrivateKey,
  getTransactionBodySignatureWithoutNodeAccountId,
  getUInt8ArrayFromBytesString,
  openTransactionInHashscan,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppStepper from '@renderer/components/ui/AppStepper.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import SignatureStatus from '@renderer/components/SignatureStatus.vue';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';

import txTypeComponentMapping from './txTypeComponentMapping';
import ReadOnlyApproversList from '@renderer/components/Approvers/ReadOnlyApproversList.vue';

/* Stores */
const user = useUserStore();
const network = useNetwork();
const contacts = useContactsStore();

/* Composables */
const router = useRouter();
const toast = useToast();
const ws = useDisposableWs();
useSetDynamicLayout({
  loggedInClass: true,
  shouldSetupAccountClass: false,
  showMenu: true,
});

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

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
const confirmCallback = ref<((...any) => void) | null>(null);
const isSigning = ref(false);
const isApproving = ref(false);
const isConfirmModalLoadingState = ref(false);
const confirmModalLoadingText = ref('');

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
  if (isLoggedInOrganization(user.selectedOrganization)) {
    const status = orgTransaction.value?.status;
    let tab: string = '';

    if (router.previousPath.startsWith('/transaction-group/')) {
      const groupId = orgTransaction.value?.groupItem.groupId;
      router.push({
        name: 'transactionGroupDetails',
        params: { id: groupId },
        query: {
          sign: 'true',
        },
      });
      return;
    }

    switch (status) {
      case TransactionStatus.EXECUTED:
      case TransactionStatus.FAILED:
      case TransactionStatus.EXPIRED:
      case TransactionStatus.CANCELED:
        tab = 'History';
        break;
      case TransactionStatus.WAITING_FOR_EXECUTION:
        tab = 'Ready for Execution';
        break;
      case TransactionStatus.WAITING_FOR_SIGNATURES:
        tab = 'In Progress';
        break;
      default:
        tab = 'History';
        break;
    }

    router.push({
      name: 'transactions',
      query: {
        tab,
      },
    });
  } else {
    redirectToHistory();
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

  if (!isLoggedInWithValidPassword(user.personal)) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    userPasswordModalRef.value?.open(
      'Enter your application password',
      'Enter your application password to decrypt your private key',
      handleSign,
    );
    return;
  }

  try {
    isSigning.value = true;

    const publicKeysRequired = await publicRequiredToSign(
      sdkTransaction.value,
      user.selectedOrganization.userKeys,
      network.mirrorNodeBaseURL,
    );

    await fullUploadSignatures(
      user.personal,
      user.selectedOrganization,
      publicKeysRequired,
      sdkTransaction.value,
      orgTransaction.value.id,
    );
    toast.success('Transaction signed successfully');
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to sign transaction');
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

    const personalPassword = user.getPassword();
    if (!personalPassword) {
      if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
      userPasswordModalRef.value?.open(
        'Enter your application password',
        'Enter your application password to decrypt your private key',
        callback,
      );
      return;
    }

    try {
      if (approved) {
        isApproving.value = true;
      } else {
        isConfirmModalLoadingState.value = true;
      }

      const publicKey = user.selectedOrganization.userKeys[0].publicKey;
      const privateKeyRaw = await decryptPrivateKey(user.personal.id, personalPassword, publicKey);
      const privateKey = getPrivateKey(publicKey, privateKeyRaw);

      const signature = await getTransactionBodySignatureWithoutNodeAccountId(
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
        redirectToHistory();
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

  redirectToHistory();
};

const handleSubmit = async e => {
  e.preventDefault();

  if (!isLoggedInOrganization(user.selectedOrganization)) return;

  const buttonContent = e.submitter?.textContent;

  if ([reject, approve].includes(buttonContent)) {
    await handleApprove(buttonContent === approve, true);
  } else if (buttonContent === sign) {
    await handleSign();
  } else {
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
      transactionBytes = await hexToUint8Array(orgTransaction.value.body);
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
      localTransaction.value = await getTransaction(id);
      transactionBytes = getUInt8ArrayFromBytesString(localTransaction.value.body);
      publicKeysRequiredToSign.value = null;
    } catch (error) {
      router.previousPath ? router.back() : router.push({ name: 'transactions' });
      throw error;
    }
  }

  try {
    sdkTransaction.value = SDKTransaction.fromBytes(transactionBytes);
  } catch (error) {
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

function redirectToHistory() {
  router.push({
    name: 'transactions',
    query: {
      tab: 'History',
    },
  });
}

/* Hooks */
onBeforeMount(async () => {
  const id = router.currentRoute.value.params.id;
  if (!id) {
    router.back();
    return;
  }

  ws.on(TRANSACTION_ACTION, async () => {
    await fetchTransaction(Array.isArray(id) ? id[0] : id);
  });

  await fetchTransaction(Array.isArray(id) ? id[0] : id);
});

/* Watchers */
watch(
  () => user.selectedOrganization,
  () => {
    router.back();
  },
);

/* Misc */
const sectionHeadingClass = 'd-flex justify-content-between align-items-center';
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small mt-1';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';
const reject = 'Reject';
const approve = 'Approve';
const sign = 'Sign';
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
              </div>
            </div>

            <div class="fill-remaining mt-5">
              <!-- Name -->
              <!-- <div
                v-if="
                  (orgTransaction?.name.trim() || localTransaction?.name.trim() || '').length > 0
                "
              >
                <h4 :class="detailItemLabelClass">Name</h4>
                <p :class="detailItemValueClass" data-testid="p-transaction-details-name">
                  {{ orgTransaction?.name || localTransaction?.name }}
                </p>
              </div> -->

              <!-- Description -->
              <!-- <div
                v-if="
                  (orgTransaction?.description.trim() || localTransaction?.description.trim() || '')
                    .length > 0
                "
                class="mt-5"
              >
                <h4 :class="detailItemLabelClass">Description</h4>
                <p :class="detailItemValueClass">
                  {{ orgTransaction?.description || localTransaction?.description }}
                </p>
              </div> -->

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
              <h2 class="text-title text-bold">Creation Details</h2>

              <div class="row flex-wrap">
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
                  v-if="localTransaction || stepperActiveIndex === stepperItems.length - 1"
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
      <div class="modal-body">
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
