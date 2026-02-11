<script setup lang="ts">
import type { Transaction } from '@prisma/client';
import type { ITransactionFull } from '@shared/interfaces';

import { computed, onBeforeMount, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import { TransactionStatus } from '@shared/interfaces';
import { TRANSACTION_ACTION } from '@shared/constants';
import { CommonNetwork } from '@shared/enums';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useContactsStore from '@renderer/stores/storeContacts';

import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import useWebsocketSubscription from '@renderer/composables/useWebsocketSubscription';

import { getTransactionGroupById, getTransactionById } from '@renderer/services/organization';
import { getTransaction } from '@renderer/services/transactionService';

import {
  getTransactionPayerId,
  getTransactionType,
  getTransactionValidStart,
} from '@renderer/utils/sdk/transactions';
import {
  getUInt8ArrayFromBytesString,
  openTransactionInHashscan,
  hexToUint8Array,
  isLoggedInOrganization,
  computeSignatureKey,
  getAccountNicknameFromId,
  getAccountIdWithChecksum,
} from '@renderer/utils';

import AppLoader from '@renderer/components/ui/AppLoader.vue';
import SignatureStatus from '@renderer/components/SignatureStatus.vue';
import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ReadOnlyApproversList from '@renderer/components/Approvers/ReadOnlyApproversList.vue';

import txTypeComponentMapping from '@renderer/components/Transaction/Details/txTypeComponentMapping';

import TransactionDetailsHeader from './components/TransactionDetailsHeader.vue';
import TransactionDetailsStatusStepper from './components/TransactionDetailsStatusStepper.vue';
import { getGroup } from '@renderer/services/transactionGroupsService';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import DateTimeString from '@renderer/components/ui/DateTimeString.vue';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import TransactionId from '@renderer/components/ui/TransactionId.vue';

/* Stores */
const user = useUserStore();
const network = useNetwork();
const contacts = useContactsStore();

/* Composables */
const router = useRouter();
useWebsocketSubscription(TRANSACTION_ACTION, async () => {
  await fetchTransaction();
});
useSetDynamicLayout(LOGGED_IN_LAYOUT);
const route = useRoute();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();

/* State */
const orgTransaction = ref<ITransactionFull | null>(null);
const localTransaction = ref<Transaction | null>(null);
const sdkTransaction = ref<SDKTransaction | null>(null);
const signatureKeyObject = ref<Awaited<ReturnType<typeof computeSignatureKey>> | null>(null);
const feePayer = ref<string | null>(null);
const feePayerNickname = ref<string | null>(null);
const groupDescription = ref<string | undefined>(undefined);

/* Computed */
const transactionSpecificLabel = computed(() => {
  if (!sdkTransaction.value || !(sdkTransaction.value instanceof SDKTransaction))
    return 'Transaction Specific Details';
  return `${getTransactionType(sdkTransaction.value, false, true)} Info`;
});

const signersPublicKeys = computed(() => {
  return sdkTransaction.value ? [...sdkTransaction.value._signerPublicKeys] : [];
});

const creator = computed(() => {
  return orgTransaction.value
    ? contacts.contacts.find(contact =>
        contact.userKeys.some(k => k.id === orgTransaction.value?.creatorKeyId),
      )
    : null;
});

const showExternal = computed(() => {
  // External badges are displayed for the transaction creator only
  return isLoggedInOrganization(user.selectedOrganization) ?
    user.selectedOrganization?.userId === orgTransaction.value?.creatorId :
    false;
});

/* Functions */
async function fetchTransaction() {
  const id = formattedId.value!;
  let transactionBytes: Uint8Array;
  try {
    if (isLoggedInOrganization(user.selectedOrganization) && !isNaN(Number(id))) {
      orgTransaction.value = await getTransactionById(
        user.selectedOrganization?.serverUrl || '',
        Number(id),
      );
      transactionBytes = hexToUint8Array(orgTransaction.value.transactionBytes);

      if (orgTransaction.value?.groupItem?.groupId) {
        if (user.selectedOrganization?.serverUrl) {
          const orgGroup = await getTransactionGroupById(
            user.selectedOrganization?.serverUrl,
            orgTransaction.value.groupItem.groupId,
          );
          groupDescription.value = orgGroup.description;
        }
      }
    } else {
      localTransaction.value = await getTransaction(id.toString());
      transactionBytes = getUInt8ArrayFromBytesString(localTransaction.value.body);
      if (localTransaction.value?.group_id) {
        const localGroup = await getGroup(localTransaction.value.group_id.toString());
        groupDescription.value = localGroup.description;
      }
    }
  } catch (error) {
    router.back();
    throw error;
  }

  try {
    sdkTransaction.value = SDKTransaction.fromBytes(transactionBytes);
  } catch {
    throw new Error('Failed to deserialize transaction');
  }

  if (!(sdkTransaction.value instanceof SDKTransaction)) {
    router.back();
    return;
  }

  if (isLoggedInOrganization(user.selectedOrganization)) {
    signatureKeyObject.value = await computeSignatureKey(
      sdkTransaction.value,
      network.mirrorNodeBaseURL,
      accountByIdCache,
      nodeByIdCache,
      user.selectedOrganization,
    );
  }

  feePayer.value = getTransactionPayerId(sdkTransaction.value);
}

const formattedId = computed(() => {
  const id = router.currentRoute.value.params.id;
  return id ? (Array.isArray(id) ? id[0] : id) : null;
});

/* Hooks */
onBeforeMount(async () => {
  const id = formattedId.value;

  if (!id) {
    router.back();
    return;
  }

  await fetchTransaction();
});

onBeforeRouteLeave(to => {
  if (to.name === 'transactionGroupDetails') {
    if (route.query.fromInProgress) {
      to.query = { ...to.query, previousTab: 'inProgress' };
    } else {
      to.query = { ...to.query, previousTab: 'transactionDetails' };
    }
  }
});

/* Watchers */
watch(() => user.selectedOrganization, router.back);

watch(feePayer, async newFeePayer => {
  if (newFeePayer) {
    feePayerNickname.value = await getAccountNicknameFromId(newFeePayer.toString());
  } else {
    feePayerNickname.value = null;
  }
});

/* Misc */
const sectionHeadingClass = 'd-flex justify-content-between align-items-center';
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small mt-1 text-break';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';
</script>
<template>
  <div class="p-5">
    <div class="flex-column-100 overflow-hidden">
      <div class="flex-column-100">
        <TransactionDetailsHeader
          :organization-transaction="orgTransaction"
          :sdk-transaction="sdkTransaction as SDKTransaction"
          :local-transaction="localTransaction"
          :on-action="fetchTransaction"
        />

        <Transition name="fade" mode="out-in">
          <template
            v-if="
              (!orgTransaction && !localTransaction) ||
              !sdkTransaction ||
              !(sdkTransaction instanceof SDKTransaction)
            "
          >
            <div class="flex-column-100 justify-content-center">
              <AppLoader class="mb-7" />
            </div>
          </template>
          <template v-else>
            <div class="fill-remaining mt-5">
              <div class="row flex-wrap">
                <!-- Description -->
                <div class="col-11">
                  <div
                    v-if="
                      (
                        orgTransaction?.description?.trim() ||
                        localTransaction?.description?.trim() ||
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
                <TransactionDetailsStatusStepper :transaction="orgTransaction" />
              </div>

              <!-- Approvers -->
              <div
                v-if="orgTransaction?.approvers && orgTransaction.approvers.length > 0"
                class="mt-5"
              >
                <h4 class="text-title text-bold">Approvers</h4>
                <ReadOnlyApproversList :approvers="orgTransaction?.approvers" />
              </div>

              <hr v-if="isLoggedInOrganization(user.selectedOrganization)" class="separator my-8" />

              <!-- TRANSACTION GROUP DETAILS -->
              <div v-if="groupDescription">
                <h2 class="text-title text-bold mt-5">Transaction Group</h2>

                <div class="row flex-wrap mt-5">
                  <!-- Description -->
                  <div class="col-18 col-lg-15 col-xl-12 col-xxl-9 overflow-hidden py-3">
                    <h4 :class="detailItemLabelClass">Description</h4>
                    <p :class="detailItemValueClass">{{ groupDescription }}</p>
                  </div>
                </div>

                <hr class="separator my-5" />
              </div>

              <!-- CREATION DETAILS -->
              <h2 class="text-title text-bold mt-5">Creation Details</h2>

              <div class="row flex-wrap mt-5">
                <!-- Creator -->
                <template v-if="creator">
                  <div :class="commonColClass">
                    <h4 :class="detailItemLabelClass">Creator</h4>
                    <p :class="detailItemValueClass">
                      <span v-if="creator?.nickname?.trim().length > 0">
                        <span class="text-pink">{{ creator?.nickname?.trim() }}</span>
                        <span> ({{ creator?.user?.email }})</span>
                      </span>
                      <span v-else>{{ creator?.user?.email }}</span>
                    </p>
                  </div>
                </template>

                <!-- Transaction Created -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Created at</h4>
                  <p :class="detailItemValueClass" data-testid="p-transaction-details-created-at">
                    <DateTimeString
                      :date="
                        new Date(
                          orgTransaction?.createdAt || localTransaction?.created_at || Date.now(),
                        )
                      "
                    />
                  </p>
                </div>

                <!-- Transaction Executed -->
                <div
                  v-if="orgTransaction?.executedAt || localTransaction?.executed_at"
                  :class="commonColClass"
                >
                  <h4 :class="detailItemLabelClass">Executed at</h4>
                  <p :class="detailItemValueClass" data-testid="p-transaction-details-executed_at">
                    <DateTimeString
                      :date="
                        new Date(orgTransaction?.executedAt || localTransaction!.executed_at * 1000)
                      "
                    />
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
                    (localTransaction ||
                      (orgTransaction &&
                        [TransactionStatus.EXECUTED, TransactionStatus.FAILED].includes(
                          orgTransaction.status,
                        )))
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
                    {{ getTransactionType(sdkTransaction, false, true) }}
                  </p>
                </div>

                <!-- Transaction ID -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Transaction ID</h4>
                  <p :class="detailItemValueClass" data-testid="p-transaction-details-id">
                    <TransactionId :transaction-id="sdkTransaction.transactionId" />
                  </p>
                </div>

                <!-- Transaction Valid Start -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Valid Start</h4>
                  <p :class="detailItemValueClass" data-testid="p-transaction-details-valid-start">
                    <DateTimeString :date="getTransactionValidStart(sdkTransaction)"/>
                  </p>
                </div>

                <!-- Transaction Fee Payer -->
                <div :class="commonColClass">
                  <h4 :class="detailItemLabelClass">Fee Payer</h4>
                  <p
                    :class="detailItemValueClass"
                    data-testid="p-transaction-details-fee-payer"
                    v-if="feePayer"
                  >
                    <span v-if="feePayerNickname">{{
                      `${feePayerNickname} (${getAccountIdWithChecksum(feePayer)})`
                    }}</span>
                    <span v-else>{{ getAccountIdWithChecksum(feePayer) }}</span>
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
                  :show-external="showExternal"
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
          </template>
        </Transition>
      </div>
    </div>
  </div>
</template>
