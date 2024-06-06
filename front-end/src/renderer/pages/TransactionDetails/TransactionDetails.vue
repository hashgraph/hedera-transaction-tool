<script setup lang="ts">
import { computed, inject, onBeforeMount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { KeyList, Transaction as SDKTransaction } from '@hashgraph/sdk';
import { Transaction } from '@prisma/client';

import { ITransactionFull, TransactionStatus } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useContactsStore from '@renderer/stores/storeContacts';

import { useToast } from 'vue-toast-notification';
import useDisposableWs from '@renderer/composables/useDisposableWs';

import {
  fullUploadSignatures,
  getTransactionById,
  sendApproverChoice,
} from '@renderer/services/organization';
import { getTransaction } from '@renderer/services/transactionService';
import { hexToUint8Array } from '@renderer/services/electronUtilsService';
import { decryptPrivateKey } from '@renderer/services/keyPairService';

import { USER_PASSWORD_MODAL_KEY, USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import {
  isLoggedInOrganization,
  isLoggedInWithPassword,
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
  getUInt8ArrayFromString,
  openTransactionInHashscan,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppStepper from '@renderer/components/ui/AppStepper.vue';
import KeyStructureSignatureStatus from '@renderer/components/KeyStructureSignatureStatus.vue';
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

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

/* State */
const orgTransaction = ref<ITransactionFull | null>(null);
const localTransaction = ref<Transaction | null>(null);
const sdkTransaction = ref<SDKTransaction | null>(null);
const signatureKey = ref<KeyList | null>(null);

/* Computed */
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

/* Handlers */
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

  if (!isLoggedInWithPassword(user.personal)) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    userPasswordModalRef.value?.open(
      'Enter your application password',
      'Enter your application password to decrypt your private key',
      handleSign,
    );
    return;
  }

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
};

const handleApprove = async (approved: boolean) => {
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

    if (!isLoggedInWithPassword(user.personal)) {
      if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
      userPasswordModalRef.value?.open(
        'Enter your application password',
        'Enter your application password to decrypt your private key',
        callback,
      );
      return;
    }

    const publicKey = user.selectedOrganization.userKeys[0].publicKey;
    const privateKeyRaw = await decryptPrivateKey(
      user.personal.id,
      user.personal.password,
      publicKey,
    );
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
  };

  await callback();
};

const handleSubmit = async e => {
  e.preventDefault();

  if (!isLoggedInOrganization(user.selectedOrganization)) return;

  if (router.currentRoute.value.query.approve) {
    const choice = e.submitter?.textContent;
    await handleApprove(choice === approve);
  } else if (router.currentRoute.value.query.sign) {
    await handleSign();
  }
};

/* Functions */
async function fetchTransaction(id: string | number) {
  let transactionBytes: Uint8Array;
  if (isLoggedInOrganization(user.selectedOrganization) && !isNaN(Number(id))) {
    orgTransaction.value = await getTransactionById(
      user.selectedOrganization?.serverUrl || '',
      Number(id),
    );
    transactionBytes = await hexToUint8Array(orgTransaction.value.body);
  } else {
    localTransaction.value = await getTransaction(id);
    transactionBytes = getUInt8ArrayFromString(localTransaction.value.body);
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
    signatureKey.value = await computeSignatureKey(sdkTransaction.value, network.mirrorNodeBaseURL);
  }
}

/* Hooks */
onBeforeMount(async () => {
  const id = router.currentRoute.value.params.id;
  if (!id) {
    router.back();
    return;
  }

  ws.on('transaction_action', async () => {
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
const commonColClass = 'col-6 col-md-5 col-lg-4 col-xl-3 py-3';
const stepperItems = [
  { title: 'Transaction Created', name: 'Transaction Created' },
  { title: 'Collecting Signatures', name: 'Collecting Signatures' },
  { title: 'Awaiting Execution', name: 'Awaiting Execution' },
  { title: 'Executed', name: 'Executed' },
];
const reject = 'Reject';
const approve = 'Approve';
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
                @click="$router.back()"
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
                  @click="$router.back()"
                >
                  <i class="bi bi-arrow-left"></i>
                </AppButton>

                <h2 class="text-title text-bold">Transaction Details</h2>
              </div>
              <div v-if="$route.query.sign">
                <AppButton color="primary" type="submit">Sign</AppButton>
              </div>
              <div v-if="$route.query.approve">
                <AppButton color="secondary" type="submit" class="me-3">{{ reject }}</AppButton>
                <AppButton color="primary" type="submit">{{ approve }}</AppButton>
              </div>
            </div>

            <div class="fill-remaining mt-5">
              <!-- Name -->
              <div
                v-if="
                  (orgTransaction?.name.trim() || localTransaction?.name.trim() || '').length > 0
                "
              >
                <h4 :class="detailItemLabelClass">Name</h4>
                <p :class="detailItemValueClass">
                  {{ orgTransaction?.name || localTransaction?.name }}
                </p>
              </div>

              <!-- Description -->
              <div
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

              <hr class="separator my-8" />

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
                  <p :class="detailItemValueClass">{{ getTransactionType(sdkTransaction) }}</p>
                </div>

                <!-- Transaction ID -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Transaction ID</h4>
                  <p :class="detailItemValueClass">{{ getTransactionId(sdkTransaction) }}</p>
                </div>

                <!-- Transaction Valid Start -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Valid Start</h4>
                  <p :class="detailItemValueClass">
                    {{ getTransactionDateExtended(sdkTransaction) }}
                  </p>
                </div>

                <!-- Transaction Fee Payer -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Fee Payer</h4>
                  <p :class="detailItemValueClass">
                    {{ getTransactionPayerId(sdkTransaction) }}
                  </p>
                </div>
              </div>

              <!-- Transaction Memo -->
              <div v-if="sdkTransaction.transactionMemo" class="mt-5">
                <h4 :class="detailItemLabelClass">Transaction Memo</h4>
                <p :class="detailItemValueClass">
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

              <!-- CREATION DETAILS -->
              <h2 class="text-title text-bold">Creation Details</h2>

              <div class="row flex-wrap">
                <!-- Creator -->
                <template v-if="creator">
                  <div :class="commonColClass">
                    <h4 :class="detailItemLabelClass">Creator</h4>
                    <p :class="detailItemValueClass">
                      {{ creator?.nickname?.trim() || creator?.user?.email || 'Unknown' }}
                    </p>
                  </div>
                </template>

                <!-- Transaction Created -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Created at</h4>
                  <p :class="detailItemValueClass">
                    {{
                      getDateStringExtended(
                        new Date(
                          orgTransaction?.createdAt || localTransaction?.created_at || Date.now(),
                        ),
                      )
                    }}
                  </p>
                </div>
              </div>

              <hr v-if="signatureKey" class="separator my-5" />

              <!-- SIGNATURES COLLECTED -->
              <h2 v-if="signatureKey" class="text-title text-bold">Signatures Collected</h2>
              <div v-if="signatureKey" class="text-small mt-5">
                <KeyStructureSignatureStatus
                  :keyList="signatureKey"
                  :public-keys-signed="signersPublicKeys"
                />
              </div>

              <hr v-if="orgTransaction?.observers" class="separator my-5" />

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

              <!-- Approvers -->
              <div
                v-if="orgTransaction?.approvers && orgTransaction?.approvers.length > 0"
                class="mt-5"
              >
                <h4 class="text-title text-bold">Approvers</h4>
                <ReadOnlyApproversList :approvers="orgTransaction?.approvers" />
              </div>
            </div>
          </form>
        </template>
      </Transition>
    </div>
  </div>
</template>
