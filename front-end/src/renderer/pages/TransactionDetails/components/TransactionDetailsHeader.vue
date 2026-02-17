<script lang="ts" setup>
import type { Transaction } from '@prisma/client';
import type { ITransactionFull, TransactionFile } from '@shared/interfaces';

import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useContactsStore from '@renderer/stores/storeContacts';
import useNextTransactionV2 from '@renderer/stores/storeNextTransactionV2.ts';

import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import {
  archiveTransaction,
  cancelTransaction,
  executeTransaction,
  getUserShouldApprove,
  remindSigners,
  sendApproverChoice,
} from '@renderer/services/organization';
import { decryptPrivateKey } from '@renderer/services/keyPairService';
import { saveFileToPath, showSaveDialog } from '@renderer/services/electronUtilsService';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  generateTransactionExportFileName,
  generateTransactionV1ExportContent,
  generateTransactionV2ExportContent,
  getErrorMessage,
  getLastExportExtension,
  getPrivateKey,
  getTransactionBodySignatureWithoutNodeAccountId,
  hexToUint8Array,
  isLoggedInOrganization,
  setLastExportExtension,
  signTransactions,
  usersPublicRequiredToSign,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';
import AppDropDown from '@renderer/components/ui/AppDropDown.vue';
import NextTransactionCursor from '@renderer/components/NextTransactionCursor.vue';
import SplitSignButtonDropdown from '@renderer/components/SplitSignButtonDropdown.vue';

import { TransactionStatus } from '@shared/interfaces';

import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';
import { writeTransactionFile } from '@renderer/services/transactionFileService.ts';
import { getTransactionType } from '@renderer/utils/sdk/transactions.ts';
import BreadCrumb from '@renderer/components/BreadCrumb.vue';

/* Types */
type ActionButton =
  | 'Reject'
  | 'Approve'
  | 'Sign'
  | 'Sign & Next'
  | 'Cancel'
  | 'Export'
  | 'Schedule'
  | 'Remind Signers'
  | 'Archive';

/* Misc */
const reject: ActionButton = 'Reject';
const approve: ActionButton = 'Approve';
const sign: ActionButton = 'Sign';
const signAndNext: ActionButton = 'Sign & Next';
const execute: ActionButton = 'Schedule';
const cancel: ActionButton = 'Cancel';
const remindSignersLabel: ActionButton = 'Remind Signers';
const archive: ActionButton = 'Archive';
const exportName: ActionButton = 'Export';

const primaryButtons: ActionButton[] = [reject, approve, sign, execute];
const buttonsDataTestIds: { [key: string]: string } = {
  [reject]: 'button-reject-org-transaction',
  [approve]: 'button-approve-org-transaction',
  [sign]: 'button-sign-org-transaction',
  [execute]: 'button-execute-org-transaction',
  [cancel]: 'button-cancel-org-transaction',
  [remindSignersLabel]: 'button-remind-signers-org-transaction',
  [archive]: 'button-archive-org-transaction',
  [exportName]: 'button-export-transaction',
};

const EXPORT_FORMATS = [
  {
    name: 'TX2 (Tx Tool 2.0)',
    value: 'tt2',
    extensions: ['tx2'],
    enabled: true, // Set to false to hide/remove in the future
  },
  {
    name: 'TX (Tx Tool 1.0)',
    value: 'tt1',
    extensions: ['tx'],
    enabled: true, // Set to false to hide/remove
  },
];

/* Props */
const props = defineProps<{
  organizationTransaction: ITransactionFull | null;
  localTransaction: Transaction | null;
  sdkTransaction: SDKTransaction | null;
  onAction: () => Promise<void>;
}>();

/* Stores */
const user = useUserStore();
const network = useNetwork();
const contacts = useContactsStore();
const nextTransaction = useNextTransactionV2();

/* Composables */
const router = useRouter();
const toast = useToast();
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();

/* State */
const isTransactionVersionMismatch = ref(false);
const isConfirmModalShown = ref(false);
const confirmModalTitle = ref('');
const confirmModalText = ref('');
const confirmModalButtonText = ref('');
const confirmModalLoadingText = ref('');
const confirmCallback = ref<((...args: any[]) => void) | null>(null);

const isRefreshing = ref(false);
const loadingStates = reactive<{ [key: string]: string | null }>({
  [reject]: null,
  [approve]: null,
  [sign]: null,
});
const isConfirmModalLoadingState = ref(false);

const publicKeysRequiredToSign = ref<string[] | null>(null);
const shouldApprove = ref<boolean>(false);

/* Computed */
const txType = computed(() => {
  return props.sdkTransaction ? getTransactionType(props.sdkTransaction) : null;
});

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

  if (isTransactionVersionMismatch.value) {
    toast.error('Transaction version mismatch. Cannot sign.', errorToastOptions);
    return false;
  }

  const userShouldSign = publicKeysRequiredToSign.value.length > 0;

  return (
    userShouldSign &&
    props.organizationTransaction.status === TransactionStatus.WAITING_FOR_SIGNATURES
  );
});

const canExecute = computed(() => {
  const status = props.organizationTransaction?.status;
  const isManual = props.organizationTransaction?.isManual;

  return status === TransactionStatus.WAITING_FOR_EXECUTION && isManual && isCreator.value;
});

const canRemind = computed(() => {
  const status = props.organizationTransaction?.status;

  return status === TransactionStatus.WAITING_FOR_SIGNATURES && isCreator.value;
});

const canArchive = computed(() => {
  const isManual = props.organizationTransaction?.isManual;

  return isManual && isCreator.value && transactionIsInProgress.value;
});

const visibleButtons = computed(() => {
  const buttons: ActionButton[] = [];

  /* The order is important REJECT, APPROVE, SIGN, SUBMIT, CANCEL, ARCHIVE, EXPORT */
  shouldApprove.value && buttons.push(reject, approve);
  canSign.value && !shouldApprove.value && buttons.push(sign);
  canExecute.value && buttons.push(execute);
  canCancel.value && buttons.push(cancel);
  canRemind.value && buttons.push(remindSignersLabel);
  canArchive.value && buttons.push(archive);
  buttons.push(exportName);

  return buttons;
});

const dropDownItems = computed(() =>
  visibleButtons.value.slice(1).map(item => ({ label: item, value: item })),
);

const flatBreadCrumb = computed(() => {
  return nextTransaction.contextStack.length === 0;
});

/* Handlers */
const handleBack = async () => {
  await nextTransaction.routeUp(router);
};

const handleSign = async (goNext = false) => {
  if (!(props.sdkTransaction instanceof SDKTransaction) || !props.organizationTransaction) {
    throw new Error('Transaction is not available');
  }

  assertUserLoggedIn(user.personal);
  assertIsLoggedInOrganization(user.selectedOrganization);

  const personalPassword = getPassword(handleSign.bind(null, goNext), {
    subHeading: 'Enter your application password to access your private key',
  });
  if (passwordModalOpened(personalPassword)) return;

  try {
    loadingStates[sign] = 'Signing…';

    const signed = await signTransactions(
      [props.organizationTransaction],
      personalPassword,
      accountByIdCache,
      nodeByIdCache,
    );
    await props.onAction();

    if (signed) {
      toast.success('Transaction signed successfully', successToastOptions);
      if (goNext) {
        await nextTransaction.routeToNext(router);
      }
    } else {
      toast.error('Failed to sign transaction', errorToastOptions);
    }
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to sign transaction'), errorToastOptions);
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
    confirmModalLoadingText.value = 'Rejecting…';
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
        loadingStates[approve] = 'Approving…';
      } else {
        loadingStates[reject] = 'Rejecting…';
        isConfirmModalLoadingState.value = true;
      }

      const orgKey = user.selectedOrganization.userKeys.filter(k => k.mnemonicHash)[0];
      const privateKeyRaw = await decryptPrivateKey(
        user.personal.id,
        personalPassword,
        orgKey.publicKey,
      );

      const privateKey = getPrivateKey(orgKey.publicKey, privateKeyRaw);

      const signature = getTransactionBodySignatureWithoutNodeAccountId(
        privateKey,
        props.sdkTransaction,
      );

      await sendApproverChoice(
        user.selectedOrganization.serverUrl,
        props.organizationTransaction.id,
        orgKey.id,
        signature,
        approved,
      );
      await props.onAction();
      toast.success(
        `Transaction ${approved ? 'approved' : 'rejected'} successfully`,
        successToastOptions,
      );

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
  action: 'cancel' | 'archive' | 'execute' | 'remindSigners',
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
      loadingText: 'Canceling…',
      successMessage: 'Transaction canceled successfully',
      actionFunction: cancelTransaction,
    },
    archive: {
      title: 'Archive Transaction?',
      text: 'Are you sure you want to archive the transaction? The required signers will not be able to sign it anymore.',
      buttonText: 'Confirm',
      loadingText: 'Archiving…',
      successMessage: 'Transaction archived successfully',
      actionFunction: archiveTransaction,
    },
    execute: {
      title: 'Schedule Transaction?',
      text: 'The transaction will be scheduled to execute at the specified time and processed automatically.',
      buttonText: 'Confirm',
      loadingText: 'Scheduling…',
      successMessage: 'Transaction scheduled for execution successfully',
      actionFunction: executeTransaction,
    },
    remindSigners: {
      title: 'Remind Signers?',
      text: 'All signers that have not yet signed will be sent a notification.',
      buttonText: 'Confirm',
      loadingText: 'Sending…',
      successMessage: 'Signers reminded successfully',
      actionFunction: remindSigners,
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
    await props.onAction();
    toast.success(successMessage, successToastOptions);
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
const handleRemindSigners = (showModal?: boolean) =>
  handleTransactionAction('remindSigners', showModal);

const handleExport = async () => {
  if (!props.sdkTransaction || !props.organizationTransaction) {
    throw new Error('(BUG) Transaction is not available');
  }

  assertUserLoggedIn(user.personal);

  /* Verifies the user has entered his password */
  const personalPassword = getPassword(handleExport, {
    subHeading: 'Enter your application password to export the transaction',
  });
  if (passwordModalOpened(personalPassword)) return;

  // Load the last export format the user selected, if applicable
  const enabledFormats = EXPORT_FORMATS.filter(f => f.enabled);
  const defaultFormat =
    getLastExportExtension() || (enabledFormats[0] || EXPORT_FORMATS[0]).extensions[0];

  // Move the default format to the top
  enabledFormats.sort((a /*, b*/) => (a.extensions[0] === defaultFormat ? -1 : 1));

  // Generate the default base name for the file
  const baseName = generateTransactionExportFileName(props.organizationTransaction);

  // Show the save dialog to the user, allowing them to choose the file name and location
  const { filePath, canceled } = await showSaveDialog(
    `${baseName || 'transaction'}`,
    'Export transaction',
    'Export',
    enabledFormats,
    'Export transaction',
  );

  if (canceled || !filePath) {
    return;
  }

  // Save selected format to local storage
  const ext = filePath.split('.').pop();
  if (!ext || !EXPORT_FORMATS.find(f => f.extensions[0] === ext)) {
    throw new Error(`Unsupported file extension: ${ext}`);
  }
  setLastExportExtension(ext);

  // Create file(s) based on name and selected format
  if (ext === 'tx2') {
    // Export TTv2 --> TTv2
    const tx2Content: TransactionFile = generateTransactionV2ExportContent(
      [props.organizationTransaction],
      network.network,
    );
    await writeTransactionFile(tx2Content, filePath);

    toast.success('Transaction exported successfully', successToastOptions);
  } else if (ext === 'tx') {
    // Export TTv2 --> TTv1
    if (user.publicKeys.length === 0) {
      throw new Error(
        'Exporting in the .tx format requires a signature. User must have at least one key pair to sign the transaction.',
      );
    }
    const publicKey = user.publicKeys[0]; // get the first key pair's public key
    const privateKeyRaw = await decryptPrivateKey(user.personal.id, personalPassword, publicKey);
    const privateKey = getPrivateKey(publicKey, privateKeyRaw);

    const { signedBytes, jsonContent } = await generateTransactionV1ExportContent(
      props.organizationTransaction,
      privateKey,
    );

    await saveFileToPath(signedBytes, filePath);
    const txtFilePath = filePath.replace(/\.[^/.]+$/, '.txt');
    await saveFileToPath(jsonContent, txtFilePath);

    toast.success('Transaction exported successfully', successToastOptions);
  }
};

const handleAction = async (value: ActionButton) => {
  if (value === reject) {
    await handleApprove(false, true);
  } else if (value === approve) {
    await handleApprove(true, true);
  } else if (value === sign) {
    await handleSign();
  } else if (value === signAndNext) {
    await handleSign(true);
  } else if (value === cancel) {
    await handleCancel(true);
  } else if (value === archive) {
    await handleArchive(true);
  } else if (value === execute) {
    await handleExecute(true);
  } else if (value === exportName) {
    await handleExport();
  } else if (value === remindSignersLabel) {
    await handleRemindSigners(true);
  }
};
const handleSubmit = async (e: Event) => {
  const buttonContent = (e as SubmitEvent).submitter?.textContent || '';
  await handleAction(buttonContent as ActionButton);
};

const handleDropDownItem = async (value: ActionButton) => handleAction(value);

/* Watchers */
watch(
  () => props.organizationTransaction,
  async transaction => {
    assertIsLoggedInOrganization(user.selectedOrganization);

    isRefreshing.value = true;

    if (!transaction) {
      publicKeysRequiredToSign.value = null;
      shouldApprove.value = false;
      isRefreshing.value = false;
      return;
    }

    const results = await Promise.allSettled([
      usersPublicRequiredToSign(
        SDKTransaction.fromBytes(hexToUint8Array(transaction.transactionBytes)),
        user.selectedOrganization.userKeys,
        network.mirrorNodeBaseURL,
        accountByIdCache,
        nodeByIdCache,
        user.selectedOrganization,
      ),
      getUserShouldApprove(user.selectedOrganization.serverUrl, transaction.id),
    ]);

    results[0].status === 'fulfilled' && (publicKeysRequiredToSign.value = results[0].value);
    results[1].status === 'fulfilled' && (shouldApprove.value = results[1].value);

    isRefreshing.value = false;

    results.forEach(
      r =>
        r.status === 'rejected' &&
        toast.error(
          getErrorMessage(r.reason, 'Failed to load transaction details'),
          errorToastOptions,
        ),
    );
  },
);
</script>
<template>
  <form @submit.prevent="handleSubmit">
    <div class="flex-centered justify-content-between flex-wrap gap-4">
      <div class="d-flex align-items-center gap-4">
        <AppButton
          v-if="flatBreadCrumb"
          class="btn-icon-only"
          color="secondary"
          data-testid="button-back"
          type="button"
          @click="handleBack"
        >
          <i class="bi bi-arrow-left"></i>
        </AppButton>
        <BreadCrumb v-if="txType" :leaf="txType" />
      </div>

      <div class="flex-centered gap-4">
        <NextTransactionCursor />
        <Transition mode="out-in" name="fade">
          <template v-if="visibleButtons.length > 0">
            <div>
              <SplitSignButtonDropdown
                v-if="visibleButtons[0] === sign"
                :loading="Boolean(loadingStates[sign])"
                :loading-text="loadingStates[sign] || ''"
              />
              <AppButton
                v-else
                :color="primaryButtons.includes(visibleButtons[0]) ? 'primary' : 'secondary'"
                :data-testid="buttonsDataTestIds[visibleButtons[0]]"
                :disabled="isRefreshing || Boolean(loadingStates[visibleButtons[0]])"
                :loading="Boolean(loadingStates[visibleButtons[0]])"
                :loading-text="loadingStates[visibleButtons[0]] || ''"
                type="submit"
                >{{ visibleButtons[0] }}
              </AppButton>
            </div>
          </template>
        </Transition>

        <Transition mode="out-in" name="fade">
          <template v-if="dropDownItems.length > 0">
            <div>
              <AppDropDown
                :color="'secondary'"
                :disabled="isRefreshing"
                :items="dropDownItems"
                compact
                data-testid="button-more-dropdown-lg"
                @select="handleDropDownItem($event as ActionButton)"
              />
            </div>
          </template>
        </Transition>
      </div>
    </div>
  </form>

  <AppConfirmModal
    v-model:show="isConfirmModalShown"
    :callback="confirmCallback"
    :text="confirmModalText"
    :title="confirmModalTitle"
  />
</template>
