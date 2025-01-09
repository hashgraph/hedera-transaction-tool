<script setup lang="ts">
import type { Transaction } from '@prisma/client';
import type { ITransactionFull } from '@main/shared/interfaces';

import { computed, ref, watch } from 'vue';
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
  cancelTransaction,
  getUserShouldApprove,
  sendApproverChoice,
  uploadSignatureMap,
} from '@renderer/services/organization';
import { decryptPrivateKey } from '@renderer/services/keyPairService';

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

const publicKeysRequiredToSign = ref<string[] | null>(null);
const shouldApprove = ref<boolean>(false);
const isSigning = ref(false);
const isApproving = ref(false);
const isConfirmModalLoadingState = ref(false);

/* Computed */
const creator = computed(() => {
  return props.organizationTransaction
    ? contacts.contacts.find(contact =>
        contact.userKeys.some(k => k.id === props.organizationTransaction?.creatorKeyId),
      )
    : null;
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
  if (!props.organizationTransaction || !creator.value) return false;
  if (!isLoggedInOrganization(user.selectedOrganization)) return false;

  const userIsCreator = creator.value.user.id === user.selectedOrganization.userId;
  return userIsCreator && transactionIsInProgress.value;
});

const canSign = computed(() => {
  if (!props.organizationTransaction || !publicKeysRequiredToSign.value) return false;
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
    isSigning.value = true;

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
        isApproving.value = true;
      } else {
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
      isApproving.value = false;
      isConfirmModalLoadingState.value = false;
      confirmModalLoadingText.value = '';
    }
  };

  await callback();
};

const handleCancel = async (showModal?: boolean) => {
  if (!props.organizationTransaction) {
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

  assertIsLoggedInOrganization(user.selectedOrganization);

  try {
    confirmModalLoadingText.value = 'Canceling...';
    isConfirmModalLoadingState.value = true;
    await cancelTransaction(user.selectedOrganization.serverUrl, props.organizationTransaction.id);
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

const handleSubmit = async (e: Event) => {
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

/* Watchers */
watch(
  () => props.organizationTransaction,
  async transaction => {
    assertIsLoggedInOrganization(user.selectedOrganization);

    if (!transaction) {
      publicKeysRequiredToSign.value = null;
      shouldApprove.value = false;
      return;
    }

    publicKeysRequiredToSign.value = await publicRequiredToSign(
      SDKTransaction.fromBytes(hexToUint8Array(transaction.transactionBytes)),
      user.selectedOrganization.userKeys,
      network.mirrorNodeBaseURL,
    );

    shouldApprove.value = await getUserShouldApprove(
      user.selectedOrganization.serverUrl,
      transaction.id,
    );
  },
);

/* Misc */
const reject = 'Reject';
const approve = 'Approve';
const sign = 'Sign';
const next = 'Next';
const cancel = 'Cancel';
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
        <template v-if="canCancel">
          <div>
            <AppButton color="secondary" type="submit" class="me-3">{{ cancel }}</AppButton>
          </div>
        </template>
      </Transition>
      <Transition name="fade" mode="out-in">
        <template v-if="isLoggedInOrganization(user.selectedOrganization) && shouldApprove">
          <div>
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
        </template>
        <template v-else-if="canSign">
          <div>
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
        </template>
        <template v-else-if="nextId">
          <div>
            <AppButton color="primary" data-testid="button-next-org-transaction" type="submit">{{
              next
            }}</AppButton>
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
