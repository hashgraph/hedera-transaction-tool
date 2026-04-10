<script lang="ts" setup>
import type { Transaction } from '@prisma/client';
import type { ITransactionFull } from '@shared/interfaces';
import { TransactionStatus } from '@shared/interfaces';

import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ToastManager } from '@renderer/utils/ToastManager';

import { Transaction as SDKTransaction } from '@hiero-ledger/sdk';
import { FEATURE_APPROVERS_ENABLED } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useContactsStore from '@renderer/stores/storeContacts';
import useNextTransactionV2 from '@renderer/stores/storeNextTransactionV2.ts';

import { getUserShouldApprove } from '@renderer/services/organization';

import {
  assertIsLoggedInOrganization,
  getErrorMessage,
  hexToUint8Array,
  isLoggedInOrganization,
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
const visibleButtons = ref<ActionButton[]>([sign, exportName]);
const isTransactionVersionMismatch = ref(false);
const isRefreshing = ref(false);
const loadingStates = reactive<{ [key: string]: string | null }>({
  [reject]: null,
  [approve]: null,
  [sign]: null,
});

const signStarted = ref(false);
const goNextAfterSign = ref(false);
const approveStarted = ref(false);
const isApproved = ref(false);
const exportStarted = ref(false);
const cancelStarted = ref(false);
const archiveStarted = ref(false);
const scheduleStarted = ref(false);
const remindSignersStarted = ref(false);

/* Computed */
const txType = computed(() => {
  return props.sdkTransaction ? getTransactionType(props.sdkTransaction) : null;
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

const handleAction = async (value: ActionButton) => {
  switch (value) {
    case reject:
    case approve:
      approveStarted.value = true;
      isApproved.value = value === approve;
      break;
    case sign:
    case signAndNext:
      signStarted.value = true;
      goNextAfterSign.value = value === signAndNext;
      break;
    case cancel:
      cancelStarted.value = true;
      break;
    case archive:
      archiveStarted.value = true;
      break;
    case schedule:
      scheduleStarted.value = true;
      break;
    case exportName:
      exportStarted.value = true;
      break;
    case remindSignersLabel:
      remindSignersStarted.value = true;
      break;
  }
};

const handleSubmit = async (e: Event) => {
  const buttonContent = (e as SubmitEvent).submitter?.textContent || '';
  await handleAction(buttonContent as ActionButton);
};

const didSign = async (signed: boolean) => {
  if (signed) {
    if (goNextAfterSign.value) {
      // We route to the next transaction
      if (nextTransaction.hasNext) {
        await nextTransaction.routeToNext(router);
      } else {
        await nextTransaction.routeUp(router);
      }
    } else {
      // We tell parent to refresh transaction
      await props.onAction();
    }
  } else {
    // We tell parent to refresh transaction
    await props.onAction();
  }
};

/* Watchers */
watch(
  () => props.organizationTransaction,
  async transaction => {
    assertIsLoggedInOrganization(user.selectedOrganization);

    if (!transaction) return;

    isRefreshing.value = true;

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

    const publicKeysRequiredToSign = results[0].status === 'fulfilled' ? results[0].value : [];
    const shouldApprove = results[1].status === 'fulfilled' ? results[1].value : false;

    visibleButtons.value = computeVisibleButtons(publicKeysRequiredToSign, shouldApprove);
    isRefreshing.value = false;

    results.forEach(
      r =>
        r.status === 'rejected' &&
        toastManager.error(getErrorMessage(r.reason, 'Failed to load transaction details')),
    );
  },
);

/* Functions */
const computeVisibleButtons = (publicKeysRequiredToSign: string[], shouldApprove: boolean) => {
  const buttons: ActionButton[] = [];

  if (props.organizationTransaction && isLoggedInOrganization(user.selectedOrganization)) {
    const status = props.organizationTransaction.status;
    const isManual = props.organizationTransaction.isManual;
    const creatorKeyId = props.organizationTransaction.creatorKeyId;
    const creator = contacts.contacts.find(contact =>
      contact.userKeys.some(k => k.id === creatorKeyId),
    );
    const isCreator = creator?.user.id === user.selectedOrganization.userId;
    const transactionIsInProgress = isInProgressStatus(props.organizationTransaction?.status);

    const canApprove = FEATURE_APPROVERS_ENABLED && shouldApprove && isApprovableStatus(status);
    const canSign =
      isSignableStatus(status) &&
      publicKeysRequiredToSign.length > 0 &&
      !isTransactionVersionMismatch.value;
    const canSchedule = status === TransactionStatus.WAITING_FOR_EXECUTION && isManual && isCreator;
    const canCancel = isCreator && transactionIsInProgress;
    const canRemind = status === TransactionStatus.WAITING_FOR_SIGNATURES && isCreator;
    const canArchive = isManual && isCreator && transactionIsInProgress;

    /* The order is important REJECT, APPROVE, SIGN, SUBMIT, CANCEL, ARCHIVE, EXPORT */
    canApprove && buttons.push(reject, approve);
    canSign && !canApprove && buttons.push(sign);
    canSchedule && buttons.push(schedule);
    canCancel && buttons.push(cancel);
    canRemind && buttons.push(remindSignersLabel);
    canArchive && buttons.push(archive);
    buttons.push(exportName);
  } else {
    // leaves buttons empty
  }

  return buttons;
};
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
        <div>
          <SplitSignButtonDropdown
            v-if="visibleButtons[0] === sign"
            :disabled="isRefreshing"
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
            class="extra-width"
            type="submit"
            >{{ visibleButtons[0] }}
          </AppButton>
        </div>

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
      </div>
    </div>
  </form>

  <SignTransactionController
    v-model:activate="signStarted"
    :callback="didSign"
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
    v-model:activate="exportStarted"
    :callback="props.onAction"
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
<style lang="scss" scoped>
.extra-width {
  min-width: 152px;
}
</style>
