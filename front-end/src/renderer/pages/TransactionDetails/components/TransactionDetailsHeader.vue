<script lang="ts" setup>
import type { Transaction } from '@prisma/client';
import type { ITransactionFull } from '@shared/interfaces';
import { TransactionStatus } from '@shared/interfaces';

import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ToastManager } from '@renderer/utils/ToastManager';

import { Transaction as SDKTransaction } from '@hashgraph/sdk';
import { FEATURE_APPROVERS_ENABLED } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useContactsStore from '@renderer/stores/storeContacts';
import useNextTransactionV2 from '@renderer/stores/storeNextTransactionV2.ts';

import { getUserShouldApprove } from '@renderer/services/organization';
import { showSaveDialog } from '@renderer/services/electronUtilsService';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  generateTransactionExportFileName,
  getErrorMessage,
  getLastExportExtension,
  hexToUint8Array,
  isLoggedInOrganization,
  setLastExportExtension,
  usersPublicRequiredToSign,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppDropDown from '@renderer/components/ui/AppDropDown.vue';
import NextTransactionCursor from '@renderer/components/NextTransactionCursor.vue';
import SplitSignButtonDropdown from '@renderer/components/SplitSignButtonDropdown.vue';

import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { getTransactionType } from '@renderer/utils/sdk/transactions.ts';
import BreadCrumb from '@renderer/components/BreadCrumb.vue';
import { PublicKeyOwnerCache } from '@renderer/caches/backend/PublicKeyOwnerCache.ts';
import {
  isApprovableStatus,
  isInProgressStatus,
  isSignableStatus,
} from '@renderer/utils/transactionStatusGuards.ts';
import CancelTransactionController from '@renderer/pages/TransactionDetails/CancelTransactionController.vue';
import ArchiveTransactionController from '@renderer/pages/TransactionDetails/ArchiveTransactionController.vue';
import ScheduleTransactionController from '@renderer/pages/TransactionDetails/ScheduleTransactionController.vue';
import RemindSignersController from '@renderer/pages/TransactionDetails/RemindSignersController.vue';
import SignTransactionController from '@renderer/pages/TransactionDetails/SignTransactionController.vue';
import ApproveTransactionController from '@renderer/pages/TransactionDetails/ApproveTransactionController.vue';
import ExportTransactionController from '@renderer/pages/TransactionDetails/ExportTransactionController.vue';

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
const schedule: ActionButton = 'Schedule';
const cancel: ActionButton = 'Cancel';
const remindSignersLabel: ActionButton = 'Remind Signers';
const archive: ActionButton = 'Archive';
const exportName: ActionButton = 'Export';

const primaryButtons: ActionButton[] = [reject, approve, sign, schedule];
const buttonsDataTestIds: { [key: string]: string } = {
  [reject]: 'button-reject-org-transaction',
  [approve]: 'button-approve-org-transaction',
  [sign]: 'button-sign-org-transaction',
  [schedule]: 'button-schedule-org-transaction',
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

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();
const publicKeyOwnerCache = PublicKeyOwnerCache.inject();
const toastManager = ToastManager.inject();

/* State */
const isTransactionVersionMismatch = ref(false);
const isRefreshing = ref(false);
const loadingStates = reactive<{ [key: string]: string | null }>({
  [reject]: null,
  [approve]: null,
  [sign]: null,
});

const publicKeysRequiredToSign = ref<string[] | null>(null);
const shouldApprove = ref<boolean>(false);

const signStarted = ref(false);
const goNextAfterSign = ref(false);
const approveStarted = ref(false);
const isApproved = ref(false);
const exportStarted = ref(false);
const exportFilePath = ref<string | null>(null);
const cancelStarted = ref(false);
const archiveStarted = ref(false);
const scheduleStarted = ref(false);
const remindSignersStarted = ref(false);

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

const transactionIsInProgress = computed(() =>
  isInProgressStatus(props.organizationTransaction?.status),
);

const canCancel = computed(() => {
  return isCreator.value && transactionIsInProgress.value;
});

const canSign = computed(() => {
  if (!props.organizationTransaction || !publicKeysRequiredToSign.value) return false;
  if (!isLoggedInOrganization(user.selectedOrganization)) return false;
  if (!isSignableStatus(props.organizationTransaction.status)) return false;

  if (isTransactionVersionMismatch.value) {
    toastManager.error('Transaction version mismatch. Cannot sign.');
    return false;
  }

  return publicKeysRequiredToSign.value.length > 0;
});

const canApprove = computed(() => {
  const status = props.organizationTransaction?.status;

  return FEATURE_APPROVERS_ENABLED && shouldApprove.value && isApprovableStatus(status);
});

const canSchedule = computed(() => {
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
  canApprove.value && buttons.push(reject, approve);
  canSign.value && !canApprove.value && buttons.push(sign);
  canSchedule.value && buttons.push(schedule);
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
  router.back();
};

const handleExport = async () => {
  assertUserLoggedIn(user.personal);
  if (props.sdkTransaction instanceof SDKTransaction && props.organizationTransaction !== null) {
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

    exportFilePath.value = filePath;
    exportStarted.value = true;
  } else {
    // Bug
    toastManager.error('Unable to export: transaction is not available');
  }
};

const handleAction = async (value: ActionButton) => {
  if (value === reject || value === approve) {
    approveStarted.value = true;
    isApproved.value = value === approve;
  } else if (value === sign || value === signAndNext) {
    signStarted.value = true;
    goNextAfterSign.value = value === signAndNext;
  } else if (value === cancel) {
    cancelStarted.value = true;
  } else if (value === archive) {
    archiveStarted.value = true;
  } else if (value === schedule) {
    scheduleStarted.value = true;
  } else if (value === exportName) {
    await handleExport();
  } else if (value === remindSignersLabel) {
    remindSignersStarted.value = true;
  }
};

const handleSubmit = async (e: Event) => {
  const buttonContent = (e as SubmitEvent).submitter?.textContent || '';
  await handleAction(buttonContent as ActionButton);
};

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

    const approvePromise: Promise<boolean> = FEATURE_APPROVERS_ENABLED
      ? getUserShouldApprove(user.selectedOrganization.serverUrl, transaction.id)
      : Promise.resolve(false);

    const results = await Promise.allSettled([
      usersPublicRequiredToSign(
        SDKTransaction.fromBytes(hexToUint8Array(transaction.transactionBytes)),
        user.selectedOrganization.userKeys,
        network.mirrorNodeBaseURL,
        accountByIdCache,
        nodeByIdCache,
        publicKeyOwnerCache,
        user.selectedOrganization,
      ),
      approvePromise,
    ]);

    results[0].status === 'fulfilled' && (publicKeysRequiredToSign.value = results[0].value);
    results[1].status === 'fulfilled' && (shouldApprove.value = results[1].value);

    isRefreshing.value = false;

    results.forEach(
      r =>
        r.status === 'rejected' &&
        toastManager.error(getErrorMessage(r.reason, 'Failed to load transaction details')),
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
                @select="handleAction($event as ActionButton)"
              />
            </div>
          </template>
        </Transition>
      </div>
    </div>
  </form>

  <SignTransactionController
    v-model:activate="signStarted"
    :callback="props.onAction"
    :go-next="goNextAfterSign"
    :transaction="props.organizationTransaction"
  />
  <ApproveTransactionController
    v-model:activate="approveStarted"
    :approved="isApproved"
    :callback="props.onAction"
    :sdk-transaction="props.sdkTransaction"
    :transaction="props.organizationTransaction"
  />
  <ExportTransactionController
    v-if="exportFilePath"
    v-model:activate="exportStarted"
    :callback="props.onAction"
    :file-path="exportFilePath"
    :sdk-transaction="props.sdkTransaction"
    :transaction="props.organizationTransaction"
  />
  <CancelTransactionController
    v-model:activate="cancelStarted"
    :callback="props.onAction"
    :transaction="props.organizationTransaction"
  />
  <ArchiveTransactionController
    v-model:activate="archiveStarted"
    :callback="props.onAction"
    :transaction="props.organizationTransaction"
  />
  <ScheduleTransactionController
    v-model:activate="scheduleStarted"
    :callback="props.onAction"
    :transaction="props.organizationTransaction"
  />
  <RemindSignersController
    v-model:activate="remindSignersStarted"
    :callback="props.onAction"
    :transaction="props.organizationTransaction"
  />
</template>
