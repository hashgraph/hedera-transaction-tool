<script setup lang="ts">
import type { Transaction } from '@prisma/client';
import type { ITransactionFull } from '@main/shared/interfaces';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import { TransactionStatus } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useContactsStore from '@renderer/stores/storeContacts';
import useNextTransactionStore from '@renderer/stores/storeNextTransaction';

import { useToast } from 'vue-toast-notification';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import {
  archiveTransaction,
  cancelTransaction,
  getUserShouldApprove,
  executeTransaction,
  sendApproverChoice,
  uploadSignatureMap,
} from '@renderer/services/organization';
import { decryptPrivateKey } from '@renderer/services/keyPairService';
import { saveFileNamed } from '@renderer/services/electronUtilsService';

import {
  getPrivateKey,
  getTransactionBodySignatureWithoutNodeAccountId,
  redirectToDetails,
  isLoggedInOrganization,
  publicRequiredToSign,
  getErrorMessage,
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  hexToUint8Array,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppDropDown from '@renderer/components/ui/AppDropDown.vue';

/* Types */
type ActionButton =
  | 'Reject'
  | 'Approve'
  | 'Sign'
  | 'Next'
  | 'Cancel'
  | 'Export'
  | 'Submit'
  | 'Archive';

/* Misc */
const reject: ActionButton = 'Reject';
const approve: ActionButton = 'Approve';
const sign: ActionButton = 'Sign';
const next: ActionButton = 'Next';
const cancel: ActionButton = 'Cancel';
const execute: ActionButton = 'Submit';
const archive: ActionButton = 'Archive';
const exportName: ActionButton = 'Export';

const primaryButtons: ActionButton[] = [reject, approve, sign, next];
const buttonsDataTestIds: { [key: string]: string } = {
  [reject]: 'button-reject-org-transaction',
  [approve]: 'button-approve-org-transaction',
  [sign]: 'button-sign-org-transaction',
  [next]: 'button-next-org-transaction',
  [cancel]: 'button-cancel-org-transaction',
  [execute]: 'button-execute-org-transaction',
  [archive]: 'button-archive-org-transaction',
  [exportName]: 'button-export-transaction',
};

/* Props */
const props = defineProps<{
  organizationTransaction: ITransactionFull | null;
  localTransaction: Transaction | null;
  sdkTransaction: SDKTransaction | null;
  nextId: number | string | null;
}>();

/* Stores */
const user = useUserStore();
const network = useNetwork();
const contacts = useContactsStore();
const nextTransaction = useNextTransactionStore();

/* Composables */
const router = useRouter();
const toast = useToast();
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const isConfirmModalShown = ref(false);
const confirmModalTitle = ref('');
const confirmModalText = ref('');
const confirmModalButtonText = ref('');
const confirmModalLoadingText = ref('');
const confirmCallback = ref<((...args: any[]) => void) | null>(null);

const fullyLoaded = ref(false);
const loadingStates = reactive<{ [key: string]: string | null }>({
  [reject]: null,
  [approve]: null,
  [sign]: null,
});
const isConfirmModalLoadingState = ref(false);

const publicKeysRequiredToSign = ref<string[] | null>(null);
const shouldApprove = ref<boolean>(false);

/* Computed */
const creator = computed(() => {
  return props.organizationTransaction
    ? contacts.contacts.find(contact =>
        contact.userKeys.some(k => k.id === props.organizationTransaction?.creatorKeyId),
      )
    : null;
});

const isCreator = computed(() => {
  if (!creator.value) return false;
  if (!isLoggedInOrganization(user.selectedOrganization)) return false;

  return creator.value.user.id === user.selectedOrganization.userId;
});

const isAdmin = computed(() => {
  return user.selectedOrganization.role === 'admin';
});

const transactionIsInProgress = computed(
  () =>
    props.organizationTransaction &&
    [
      TransactionStatus.NEW,
      TransactionStatus.WAITING_FOR_EXECUTION,
      TransactionStatus.WAITING_FOR_SIGNATURES,
    ].includes(props.organizationTransaction.status),
);

const canCancel = computed(() => {
  return isCreator.value && transactionIsInProgress.value;
});

const canSign = computed(() => {
  if (!props.organizationTransaction || !publicKeysRequiredToSign.value) return false;
  if (!isLoggedInOrganization(user.selectedOrganization)) return false;

  const userShouldSign = publicKeysRequiredToSign.value.length > 0;

  return userShouldSign && transactionIsInProgress.value;
});

const canExecute = computed(() => {
  const status = props.organizationTransaction?.status;
  const isManual = props.organizationTransaction?.isManual;

  return (
    status === TransactionStatus.WAITING_FOR_EXECUTION &&
    isManual &&
    (isCreator.value || isAdmin.value) &&
    transactionIsInProgress.value
  );
});

const canArchive = computed(() => {
  const isManual = props.organizationTransaction?.isManual;

  return (
    isManual &&
    (isCreator.value || isAdmin.value) &&
    transactionIsInProgress.value
  );
});

const visibleButtons = computed(() => {
  const buttons: ActionButton[] = [];

  if (!fullyLoaded.value) return buttons;

  /* The order is important REJECT, APPROVE, SIGN, SUBMIT, NEXT, CANCEL, ARCHIVE, EXPORT */
  shouldApprove.value && buttons.push(reject, approve);
  canSign.value && !shouldApprove.value && buttons.push(sign);
  canExecute.value && buttons.push(execute);
  props.nextId && !shouldApprove.value && !canSign.value && buttons.push(next);
  canCancel.value && buttons.push(cancel);
  canArchive.value && buttons.push(archive);
  buttons.push(exportName);

  return buttons;
});

const dropDownItems = computed(() =>
  visibleButtons.value.slice(1).map(item => ({ label: item, value: item })),
);

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
  if (!(props.sdkTransaction instanceof SDKTransaction) || !props.organizationTransaction) {
    throw new Error('Transaction is not available');
  }

  assertUserLoggedIn(user.personal);
  assertIsLoggedInOrganization(user.selectedOrganization);

  const personalPassword = getPassword(handleSign, {
    subHeading: 'Enter your application password to access your private key',
  });
  if (passwordModalOpened(personalPassword)) return;

  try {
    loadingStates[sign] = 'Signing...';

    const publicKeysRequired = await publicRequiredToSign(
      props.sdkTransaction,
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
        SDKTransaction.fromBytes(props.sdkTransaction.toBytes()),
        props.organizationTransaction.id,
      );
      toast.success('Transaction signed successfully');
    }
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to sign transaction'));
  } finally {
    loadingStates[sign] = null;
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
    if (!(props.sdkTransaction instanceof SDKTransaction) || !props.organizationTransaction) {
      throw new Error('Transaction is not available');
    }

    assertUserLoggedIn(user.personal);
    assertIsLoggedInOrganization(user.selectedOrganization);

    const personalPassword = getPassword(callback, {
      subHeading: 'Enter your application password to access your private key',
    });
    if (passwordModalOpened(personalPassword)) return;

    try {
      if (approved) {
        loadingStates[approve] = 'Approving...';
      } else {
        loadingStates[reject] = 'Rejecting...';
        isConfirmModalLoadingState.value = true;
      }

      const publicKey = user.selectedOrganization.userKeys[0].publicKey;
      const privateKeyRaw = await decryptPrivateKey(user.personal.id, personalPassword, publicKey);
      const privateKey = getPrivateKey(publicKey, privateKeyRaw);

      const signature = getTransactionBodySignatureWithoutNodeAccountId(
        privateKey,
        props.sdkTransaction,
      );

      await sendApproverChoice(
        user.selectedOrganization.serverUrl,
        props.organizationTransaction.id,
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
      loadingStates[approve] = null;
      loadingStates[reject] = null;
      isConfirmModalLoadingState.value = false;
      confirmModalLoadingText.value = '';
    }
  };

  await callback();
};

const handleTransactionAction = async (
  action: 'cancel' | 'archive' | 'execute',
  showModal?: boolean,
) => {
  assertIsLoggedInOrganization(user.selectedOrganization);
  if (!props.organizationTransaction) {
    throw new Error('Transaction is not available');
  }

  const actionDetails = {
    cancel: {
      title: 'Cancel Transaction?',
      text: 'Are you sure you want to cancel the transaction?',
      buttonText: 'Confirm',
      loadingText: 'Canceling...',
      successMessage: 'Transaction canceled successfully',
      actionFunction: cancelTransaction,
    },
    archive: {
      title: 'Archive Transaction?',
      text: 'Are you sure you want to archive the transaction? The required signers will not be able to sign it anymore.',
      buttonText: 'Confirm',
      loadingText: 'Archiving...',
      successMessage: 'Transaction archived successfully',
      actionFunction: archiveTransaction,
    },
    execute: {
      title: 'Submit Transaction?',
      text: 'The transaction will be scheduled to execute at the specified time and processed automatically.',
      buttonText: 'Confirm',
      loadingText: 'Submitting...',
      successMessage: 'Transaction sent for execution successfully',
      actionFunction: executeTransaction,
    },
  };

  const { title, text, buttonText, loadingText, successMessage, actionFunction } =
    actionDetails[action];

  if (showModal) {
    confirmModalTitle.value = title;
    confirmModalText.value = text;
    confirmModalButtonText.value = buttonText;
    confirmCallback.value = () => handleTransactionAction(action);
    isConfirmModalShown.value = true;
    return;
  }

  try {
    confirmModalLoadingText.value = loadingText;
    isConfirmModalLoadingState.value = true;
    await actionFunction(user.selectedOrganization.serverUrl, props.organizationTransaction.id);
    toast.success(successMessage);
  } catch (error) {
    isConfirmModalShown.value = false;
    throw error;
  } finally {
    isConfirmModalShown.value = false;
    isConfirmModalLoadingState.value = false;
    confirmModalLoadingText.value = '';
  }
};

const handleCancel = (showModal?: boolean) => handleTransactionAction('cancel', showModal);
const handleArchive = (showModal?: boolean) => handleTransactionAction('archive', showModal);
const handleExecute = (showModal?: boolean) => handleTransactionAction('execute', showModal);

const handleNext = () => {
  if (!props.nextId) return;

  const newPreviousTransactionsIds = [...(nextTransaction.previousTransactionsIds || [])];
  if (isLoggedInOrganization(user.selectedOrganization)) {
    props.organizationTransaction &&
      newPreviousTransactionsIds.push(props.organizationTransaction.id);
  } else {
    props.localTransaction && newPreviousTransactionsIds.push(props.localTransaction.id);
  }
  nextTransaction.setPreviousTransactionsIds(newPreviousTransactionsIds);

  redirectToDetails(router, props.nextId.toString(), true, true);
};

const handleExport = async () => {
  if (!props.sdkTransaction) {
    throw new Error('(BUG) Transaction is not available');
  }

  const bytes = props.sdkTransaction.toBytes();

  const transactionId = props.sdkTransaction.transactionId?.toString();
  await saveFileNamed(
    bytes,
    `${transactionId || 'transaction'}.tx`,
    'Export transaction',
    'Export',
    [],
    ['openDirectory'],
    'Export transaction',
  );
};

const handleAction = async (value: ActionButton) => {
  if (value === reject) {
    await handleApprove(false, true);
  } else if (value === approve) {
    await handleApprove(true, true);
  } else if (value === sign) {
    await handleSign();
  } else if (value === next) {
    await handleNext();
  } else if (value === cancel) {
    await handleCancel(true);
  } else if (value === archive) {
    await handleArchive(true);
  } else if (value === execute) {
    await handleExecute(true);
  } else if (value === exportName) {
    await handleExport();
  }
};
const handleSubmit = async (e: Event) => {
  const buttonContent = (e as SubmitEvent).submitter?.textContent || '';
  await handleAction(buttonContent as ActionButton);
};

const handleDropDownItem = async (value: ActionButton) => handleAction(value);

/* Hooks */
onMounted(() => {
  if (!isLoggedInOrganization(user.selectedOrganization)) {
    fullyLoaded.value = true;
  }
});

/* Watchers */
watch(
  () => props.organizationTransaction,
  async transaction => {
    assertIsLoggedInOrganization(user.selectedOrganization);

    fullyLoaded.value = false;

    if (!transaction) {
      publicKeysRequiredToSign.value = null;
      shouldApprove.value = false;
      return;
    }

    const results = await Promise.allSettled([
      publicRequiredToSign(
        SDKTransaction.fromBytes(hexToUint8Array(transaction.transactionBytes)),
        user.selectedOrganization.userKeys,
        network.mirrorNodeBaseURL,
      ),
      getUserShouldApprove(user.selectedOrganization.serverUrl, transaction.id),
    ]);

    results[0].status === 'fulfilled' && (publicKeysRequiredToSign.value = results[0].value);
    results[1].status === 'fulfilled' && (shouldApprove.value = results[1].value);

    fullyLoaded.value = true;

    results.forEach(
      r =>
        r.status === 'rejected' &&
        toast.error(getErrorMessage(r.reason, 'Failed to load transaction details')),
    );
  },
);
</script>
<template>
  <form
    @submit.prevent="handleSubmit"
    class="flex-centered justify-content-between flex-wrap gap-4"
  >
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
      <Transition name="fade" mode="out-in">
        <template v-if="visibleButtons.length > 0">
          <div>
            <AppButton
              :color="primaryButtons.includes(visibleButtons[0]) ? 'primary' : 'secondary'"
              :loading="Boolean(loadingStates[visibleButtons[0]])"
              :loading-text="loadingStates[visibleButtons[0]] || ''"
              :data-testid="buttonsDataTestIds[visibleButtons[0]]"
              type="submit"
              class="me-3"
              >{{ visibleButtons[0] }}
            </AppButton>
          </div>
        </template>
      </Transition>
      <Transition name="fade" mode="out-in">
        <template v-if="visibleButtons.length > 2">
          <AppDropDown
            :color="'secondary'"
            :items="dropDownItems"
            compact
            @select="handleDropDownItem($event as ActionButton)"
          />
        </template>
        <template v-else-if="visibleButtons.length === 2">
          <div>
            <AppButton
              :color="primaryButtons.includes(visibleButtons[1]) ? 'primary' : 'secondary'"
              :loading="Boolean(loadingStates[visibleButtons[1]])"
              :loading-text="loadingStates[visibleButtons[1]] || ''"
              :data-testid="buttonsDataTestIds[visibleButtons[1]]"
              type="submit"
              class="me-3"
              >{{ visibleButtons[1] }}
            </AppButton>
          </div>
        </template>
      </Transition>
    </div>
  </form>

  <AppModal v-model:show="isConfirmModalShown" class="common-modal">
    <div class="p-4">
      <i class="bi bi-x-lg d-inline-block cursor-pointer" @click="isConfirmModalShown = false"></i>
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
</template>
