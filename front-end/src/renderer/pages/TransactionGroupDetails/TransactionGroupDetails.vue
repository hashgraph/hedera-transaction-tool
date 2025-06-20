<script setup lang="ts">
import type { IGroup } from '@renderer/services/organization';
import { TransactionStatus } from '@main/shared/interfaces';

import { computed, onBeforeMount, ref, watch, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Transaction } from '@hashgraph/sdk';

import { historyTitle, TRANSACTION_ACTION } from '@main/shared/constants';
import { TransactionTypeName } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useNextTransactionStore from '@renderer/stores/storeNextTransaction';

import { useToast } from 'vue-toast-notification';
import useDisposableWs from '@renderer/composables/useDisposableWs';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import {
  getApiGroupById,
  getUserShouldApprove,
  sendApproverChoice,
  uploadSignatures,
} from '@renderer/services/organization';
import { decryptPrivateKey } from '@renderer/services/keyPairService';

import {
  getDateStringExtended,
  getPrivateKey,
  getTransactionBodySignatureWithoutNodeAccountId,
  redirectToDetails,
  hexToUint8Array,
  isLoggedInOrganization,
  isUserLoggedIn,
  publicRequiredToSign,
  usersPublicRequiredToSign,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';

/* Stores */
const user = useUserStore();
const network = useNetwork();
const wsStore = useWebsocketConnection();
const nextTransaction = useNextTransactionStore();

/* Composables */
const router = useRouter();
const route = useRoute();
const toast = useToast();
const ws = useDisposableWs();
useSetDynamicLayout(LOGGED_IN_LAYOUT);
const { getPassword, passwordModalOpened } = usePersonalPassword();
const createTooltips = useCreateTooltips();

/* State */
const group = ref<IGroup | null>(null);
const shouldApprove = ref(false);
const isConfirmModalShown = ref(false);
const publicKeysRequiredToSign = ref<string[] | null>([]);
const disableSignAll = ref(false);
const isSigning = ref(false);
const isApproving = ref(false);
const unsignedSignersToCheck = ref<Record<string, string[]>>({});
const tooltipRef = ref<HTMLElement[]>([]);

/* Computed */
const tooltipText = computed(() => {
  if (route.query.previousTab) {
    const previousTab = route.query.previousTab;
    if (
      previousTab === 'readyToSign' ||
      previousTab === 'transactionDetails' ||
      previousTab === 'createGroup'
    ) {
      return 'You have successfully signed the transaction!';
    } else if (previousTab === 'inProgress') {
      return 'Transaction is signed by all required signers!';
    }
  }
  return '';
});

/* Handlers */
async function handleFetchGroup(id: string | number) {
  if (isLoggedInOrganization(user.selectedOrganization) && !isNaN(Number(id))) {
    try {
      group.value = await getApiGroupById(user.selectedOrganization.serverUrl, Number(id));

      if (group.value?.groupItems != undefined) {
        for (const item of group.value.groupItems) {
          shouldApprove.value =
            shouldApprove.value ||
            (await getUserShouldApprove(user.selectedOrganization.serverUrl, item.transaction.id));

          const transactionBytes = hexToUint8Array(item.transaction.transactionBytes);
          const tx = Transaction.fromBytes(transactionBytes);
          const txId = item.transaction.id;

          const { usersPublicKeys } = await publicRequiredToSign(
            tx,
            user.selectedOrganization.userKeys,
            network.mirrorNodeBaseURL,
          );

          const signedSigners = new Set([...tx._signerPublicKeys]);

          const usersUnsigned = usersPublicKeys.length
            ? usersPublicKeys.filter(pk => !signedSigners.has(pk))
            : [];

          if (route.query.previousTab) {
            const previousTab = route.query.previousTab;
            if (
              (previousTab === 'readyToSign' ||
                previousTab === 'transactionDetails' ||
                previousTab === 'createGroup') &&
              usersPublicKeys.length > 0
            ) {
              unsignedSignersToCheck.value = {
                ...unsignedSignersToCheck.value,
                [txId]: usersUnsigned,
              };
            }
          }

          if (
            item.transaction.status !== TransactionStatus.CANCELED &&
            item.transaction.status !== TransactionStatus.EXPIRED
          ) {
            publicKeysRequiredToSign.value = publicKeysRequiredToSign.value!.concat(usersUnsigned);
          }
        }
      }
    } catch (error) {
      router.back();
      throw error;
    }
  } else {
    console.log('not logged into org');
  }
}

/* Handlers */
const handleBack = () => {
  if (!history.state?.back?.startsWith('/transactions')) {
    router.push({ name: 'transactions' });
  } else {
    router.back();
  }
};

const handleSign = async (id: number) => {
  const flatTransactions = group.value?.groupItems || [];
  const selectedTransactionIndex = flatTransactions.findIndex(t => t.transaction.id === id);
  const previousTransactionIds = flatTransactions
    .slice(0, selectedTransactionIndex)
    .map(t => t.transaction.id);
  nextTransaction.setPreviousTransactionsIds(previousTransactionIds);

  if (route.query.previousTab && route.query.previousTab === 'inProgress') {
    redirectToDetails(router, id, true, false, true);
  } else {
    redirectToDetails(router, id, true);
  }
};

const handleSignGroup = async () => {
  if (!isLoggedInOrganization(user.selectedOrganization) || !isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in organization');
  }

  const personalPassword = getPassword(handleSignGroup, {
    subHeading: 'Enter your application password to decrypt your private key',
  });
  if (passwordModalOpened(personalPassword)) return;

  try {
    isSigning.value = true;
    const items: SignatureItem[]= [];
    if (group.value != undefined) {
      for (const groupItem of group.value.groupItems) {
        const transactionBytes = hexToUint8Array(groupItem.transaction.transactionBytes);
        const transaction = Transaction.fromBytes(transactionBytes);
        if (
          groupItem.transaction.status === TransactionStatus.CANCELED ||
          groupItem.transaction.status === TransactionStatus.EXPIRED
        ) {
          continue;
        }
        const publicKeysRequired = await usersPublicRequiredToSign(
          transaction,
          user.selectedOrganization.userKeys,
          network.mirrorNodeBaseURL,
        );
        const item: SignatureItem = {
          publicKeys: publicKeysRequired,
          transaction,
          transactionId: groupItem.transaction.id,
        };
        items.push(item);
      }
    }
    await uploadSignatures(
      user.personal.id,
      personalPassword,
      user.selectedOrganization,
      null,
      null,
      null,
      items,
    );
    toast.success('Transactions signed successfully');
    disableSignAll.value = true;
  } catch {
    toast.error('Transactions not signed');
  } finally {
    isSigning.value = false;
  }
};

const handleApproveAll = async (approved: boolean, showModal?: boolean) => {
  if (!approved && showModal) {
    isConfirmModalShown.value = true;
    return;
  }

  const callback = async () => {
    if (!isLoggedInOrganization(user.selectedOrganization) || !isUserLoggedIn(user.personal)) {
      throw new Error('User is not logged in organization');
    }

    const personalPassword = getPassword(callback, {
      subHeading: 'Enter your application password to decrypt your private key',
    });
    if (passwordModalOpened(personalPassword)) return;

    try {
      isApproving.value = true;

      const publicKey = user.selectedOrganization.userKeys[0].publicKey;
      const privateKeyRaw = await decryptPrivateKey(
        user.personal.id,
        user.personal.password,
        publicKey,
      );
      const privateKey = getPrivateKey(publicKey, privateKeyRaw);

      if (group.value != undefined) {
        for (const item of group.value.groupItems) {
          if (
            await getUserShouldApprove(user.selectedOrganization.serverUrl, item.transaction.id)
          ) {
            const transactionBytes = hexToUint8Array(item.transaction.transactionBytes);
            const transaction = Transaction.fromBytes(transactionBytes);
            const signature = getTransactionBodySignatureWithoutNodeAccountId(
              privateKey,
              transaction,
            );

            await sendApproverChoice(
              user.selectedOrganization.serverUrl,
              item.transaction.id,
              user.selectedOrganization.userKeys[0].id,
              signature,
              approved,
            );
          }
        }
      }
      toast.success(`Transactions ${approved ? 'approved' : 'rejected'} successfully`);

      if (!approved) {
        router.push({
          name: 'transactions',
          query: {
            tab: historyTitle,
          },
        });
      }
    } finally {
      isApproving.value = false;
    }
  };

  await callback();
};

const subscribeToTransactionAction = () => {
  if (!user.selectedOrganization?.serverUrl) return;
  ws.on(user.selectedOrganization?.serverUrl, TRANSACTION_ACTION, async () => {
    const id = router.currentRoute.value.params.id;
    await handleFetchGroup(Array.isArray(id) ? id[0] : id);
    setGetTransactionsFunction();
  });
};

function setGetTransactionsFunction() {
  nextTransaction.setGetTransactionsFunction(async () => {
    const transactions = group.value?.groupItems.map(t => t.transaction);
    return {
      items: transactions?.map(t => t.id) || [],
      totalItems: transactions?.length || 0,
    };
  }, false);
}

/* Hooks */
onBeforeMount(async () => {
  const id = router.currentRoute.value.params.id;
  if (!id) {
    router.back();
    return;
  }

  subscribeToTransactionAction();
  await handleFetchGroup(Array.isArray(id) ? id[0] : id);
  setGetTransactionsFunction();
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

watchEffect(() => {
  if (tooltipRef.value && tooltipRef.value.length > 0) {
    createTooltips();
  }
});
</script>
<template>
  <div class="p-5">
    <div class="flex-column-100">
      <div class="d-flex align-items-center">
        <AppButton type="button" color="secondary" class="btn-icon-only me-4" @click="handleBack">
          <i class="bi bi-arrow-left"></i>
        </AppButton>

        <h2 class="text-title text-bold">Transaction Group Details</h2>
      </div>

      <Transition name="fade" mode="out-in">
        <template v-if="group">
          <div class="fill-remaining flex-column-100 mt-4">
            <div class="d-flex">
              <div class="col-6 flex-1">
                <label class="form-label">Transaction Group Description</label>
                <div>{{ group?.description }}</div>
              </div>

              <template v-if="isLoggedInOrganization(user.selectedOrganization)">
                <div class="col-6">
                  <label class="form-label">Sequential Execution</label>
                  <div>{{ group?.sequential ? 'Yes' : 'No' }}</div>
                </div>
              </template>
            </div>

            <hr class="separator my-5 w-100" />

            <Transition name="fade" mode="out-in">
              <template v-if="group.groupItems.length > 0">
                <div class="fill-remaining overflow-x-auto">
                  <table class="table-custom">
                    <thead>
                      <tr>
                        <th v-if="route.query.previousTab" class="ps-3 pe-1"></th>
                        <th :class="route.query.previousTab ? 'ps-1' : ''">
                          <div>
                            <span>Transaction ID</span>
                          </div>
                        </th>
                        <th>
                          <div>
                            <span>Transaction Type</span>
                          </div>
                        </th>
                        <th>
                          <div>
                            <span>Valid Start</span>
                          </div>
                        </th>
                        <th class="text-center">
                          <span>Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <template v-for="(groupItem, index) in group.groupItems" :key="groupItem.seq">
                        <Transition name="fade" mode="out-in">
                          <template v-if="groupItem">
                            <tr>
                              <td
                                v-if="
                                  route.query &&
                                  route.query.previousTab &&
                                  groupItem.transaction.status
                                "
                                class="pe-0 ps-3"
                              >
                                <span
                                  v-if="
                                    (route.query.previousTab !== 'inProgress' &&
                                      unsignedSignersToCheck[groupItem.transaction.id] &&
                                      unsignedSignersToCheck[groupItem.transaction.id].length ===
                                        0) ||
                                    (route.query.previousTab === 'inProgress' &&
                                      groupItem.transaction.status ===
                                        TransactionStatus.WAITING_FOR_EXECUTION)
                                  "
                                  data-bs-toggle="tooltip"
                                  data-bs-custom-class="wide-tooltip"
                                  data-bs-trigger="hover"
                                  data-bs-placement="top"
                                  :title="tooltipText"
                                  ref="tooltipRef"
                                  class="bi bi-check-lg text-success"
                                ></span>
                              </td>
                              <td
                                data-testid="td-group-transaction-id"
                                :class="
                                  Object.keys(unsignedSignersToCheck).length > 0 ? 'ps-2 pe-0' : ''
                                "
                              >
                                {{ groupItem.transaction.transactionId }}
                              </td>
                              <td>
                                <span class="text-bold">{{
                                  TransactionTypeName[groupItem.transaction.type]
                                }}</span>
                              </td>
                              <td data-testid="td-group-valid-start-time">
                                {{
                                  getDateStringExtended(new Date(groupItem.transaction.validStart))
                                }}
                              </td>
                              <td class="text-center">
                                <AppButton
                                  type="button"
                                  color="secondary"
                                  @click.prevent="handleSign(groupItem.transaction.id)"
                                  :data-testid="`button-group-transaction-${index}`"
                                  ><span>Details</span>
                                </AppButton>
                              </td>
                            </tr>
                          </template>
                        </Transition>
                      </template>
                    </tbody>
                  </table>
                </div>
              </template>

              <template v-else>
                <div class="fill-remaining flex-centered">
                  <EmptyTransactions :mode="'group-details'" />
                </div>
              </template>
            </Transition>

            <Transition name="fade" mode="out-in">
              <template
                v-if="
                  shouldApprove ||
                  (isLoggedInOrganization(user.selectedOrganization) &&
                    publicKeysRequiredToSign &&
                    publicKeysRequiredToSign.length > 0 &&
                    !disableSignAll)
                "
              >
                <div class="d-flex gap-4 mt-5">
                  <!-- Approval Actions -->
                  <template v-if="shouldApprove">
                    <AppButton
                      color="secondary"
                      type="button"
                      :loading="isApproving"
                      loading-text="Rejecting..."
                      @click="handleApproveAll(false, true)"
                    >
                      Reject All
                    </AppButton>
                    <AppButton
                      color="primary"
                      type="button"
                      :loading="isApproving"
                      loading-text="Approving..."
                      @click="handleApproveAll(true, true)"
                    >
                      Approve All
                    </AppButton>
                  </template>

                  <!-- Sign All Button -->
                  <template
                    v-if="
                      isLoggedInOrganization(user.selectedOrganization) &&
                      publicKeysRequiredToSign &&
                      publicKeysRequiredToSign.length > 0 &&
                      !disableSignAll
                    "
                  >
                    <AppButton
                      color="primary"
                      type="button"
                      :loading="isSigning"
                      loading-text="Signing..."
                      data-testid="button-sign-all-tx"
                      @click="handleSignGroup"
                    >
                      Sign All
                    </AppButton>
                  </template>
                </div>
              </template>
            </Transition>

            <AppModal v-model:show="isConfirmModalShown" class="common-modal">
              <div class="p-4">
                <i
                  class="bi bi-x-lg d-inline-block cursor-pointer"
                  @click="isConfirmModalShown = false"
                ></i>
                <div class="text-center">
                  <AppCustomIcon :name="'questionMark'" style="height: 160px" />
                </div>
                <h3 class="text-center text-title text-bold mt-4">Reject Transaction?</h3>
                <p class="text-center text-small text-secondary mt-4">
                  Are you sure you want to reject the transaction
                </p>
                <hr class="separator my-5" />
                <div class="flex-between-centered gap-4">
                  <AppButton color="borderless" @click="isConfirmModalShown = false"
                    >Cancel</AppButton
                  >
                  <AppButton
                    color="primary"
                    data-testid="button-confirm-change-password"
                    @click="handleApproveAll(false)"
                    >Reject</AppButton
                  >
                </div>
              </div>
            </AppModal>
          </div>
        </template>
        <template v-else>
          <div class="flex-column-100 justify-content-center">
            <AppLoader class="mb-7" />
          </div>
        </template>
      </Transition>
    </div>
  </div>
</template>
