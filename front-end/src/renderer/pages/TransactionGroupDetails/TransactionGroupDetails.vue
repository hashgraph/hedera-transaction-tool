<script setup lang="ts">
import type { IGroup } from '@renderer/services/organization';
import type { IGroupItem, ITransactionFull } from '@shared/interfaces';
import type { SignatureItem } from '@renderer/types';

import { computed, onBeforeMount, ref, watch, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import { Transaction } from '@hashgraph/sdk';
import JSZip from 'jszip';

import { TransactionStatus, TransactionTypeName } from '@shared/interfaces';
import { historyTitle, TRANSACTION_ACTION } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useNextTransactionStore from '@renderer/stores/storeNextTransaction';

import useDisposableWs from '@renderer/composables/useDisposableWs';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { areByteArraysEqual } from '@shared/utils/byteUtils';

import {
  generateTransactionExportContent,
  generateTransactionExportFileName,
  getTransactionById,
  getApiGroupById,
  getUserShouldApprove,
  sendApproverChoice,
  uploadSignatures,
} from '@renderer/services/organization';
import { decryptPrivateKey } from '@renderer/services/keyPairService';
import { saveFileToPath, showSaveDialog } from '@renderer/services/electronUtilsService.ts';

import {
  getDateStringExtended,
  getPrivateKey,
  getTransactionBodySignatureWithoutNodeAccountId,
  redirectToDetails,
  hexToUint8Array,
  isLoggedInOrganization,
  isUserLoggedIn,
  usersPublicRequiredToSign,
  assertUserLoggedIn,
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
const publicKeysRequiredToSign = ref<string[]>([]);
const disableSignAll = ref(false);
const isSigningAll = ref(false);
const signingItemSeq = ref(-1);
const isApproving = ref(false);
const unsignedSignersToCheck = ref<Record<number, string[]>>({});
const tooltipRef = ref<HTMLElement[]>([]);

/* Computed */
const showSignAll = computed(() => {
  return (
    isLoggedInOrganization(user.selectedOrganization) && publicKeysRequiredToSign.value.length > 0
  );
});

/* Handlers */
async function handleFetchGroup(id: string | number) {
  if (isLoggedInOrganization(user.selectedOrganization) && !isNaN(Number(id))) {
    try {
      const updatedPublicKeysRequiredToSign: string[] = [];
      const updatedUnsignedSignersToCheck: Record<number, string[]> = {};

      group.value = await getApiGroupById(user.selectedOrganization.serverUrl, Number(id));
      disableSignAll.value = false;

      if (group.value?.groupItems != undefined) {
        for (const item of group.value.groupItems) {
          const transactionBytes = hexToUint8Array(item.transaction.transactionBytes);
          const tx = Transaction.fromBytes(transactionBytes);

          const isTransactionVersionMismatch = !areByteArraysEqual(tx.toBytes(), transactionBytes);
          if (isTransactionVersionMismatch) {
            toast.error('Transaction version mismatch. Cannot sign all.');
            disableSignAll.value = true;
            break;
          }

          shouldApprove.value =
            shouldApprove.value ||
            (await getUserShouldApprove(user.selectedOrganization.serverUrl, item.transaction.id));

          const txId = item.transaction.id;

          const usersPublicKeys = await usersPublicRequiredToSign(
            tx,
            user.selectedOrganization.userKeys,
            network.mirrorNodeBaseURL,
          );

          if (
            item.transaction.status !== TransactionStatus.CANCELED &&
            item.transaction.status !== TransactionStatus.EXPIRED &&
            usersPublicKeys.length > 0
          ) {
            updatedUnsignedSignersToCheck[txId] = usersPublicKeys;
            usersPublicKeys.forEach(key => {
              if (!updatedPublicKeysRequiredToSign.includes(key)) {
                updatedPublicKeysRequiredToSign.push(key);
              }
            });
          }
        }
      }

      unsignedSignersToCheck.value = updatedUnsignedSignersToCheck;
      publicKeysRequiredToSign.value = updatedPublicKeysRequiredToSign;

      // bootstrap tooltips needs to be recreated when the items' status might have changed
      // since their title is not updated
      createTooltips();
    } catch (error) {
      router.back();
      throw error;
    }
  } else {
    console.log('not logged into org');
  }
}

const handleBack = () => {
  if (!history.state?.back?.startsWith('/transactions')) {
    router.push({ name: 'transactions' });
  } else {
    router.back();
  }
};

const handleDetails = async (id: number) => {
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

const handleSignGroupItem = async (groupItem: IGroupItem) => {
  if (!isLoggedInOrganization(user.selectedOrganization) || !isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in organization');
  }

  const personalPassword = getPassword(handleSignGroupItem.bind(null, groupItem), {
    subHeading: 'Enter your application password to decrypt your private key',
  });
  if (passwordModalOpened(personalPassword)) return;

  try {
    signingItemSeq.value = groupItem.seq;
    const transactionBytes = hexToUint8Array(groupItem.transaction.transactionBytes);
    const transaction = Transaction.fromBytes(transactionBytes);
    if (
      groupItem.transaction.status === TransactionStatus.CANCELED ||
      groupItem.transaction.status === TransactionStatus.EXPIRED
    ) {
      return Promise.resolve();
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
    const items: SignatureItem[] = [item];

    await uploadSignatures(
      user.personal.id,
      personalPassword,
      user.selectedOrganization,
      undefined,
      undefined,
      undefined,
      items,
    );

    const updatedTransaction: ITransactionFull = await getTransactionById(
      user.selectedOrganization?.serverUrl || '',
      groupItem.transactionId
    );

    const index = group.value!.groupItems.findIndex(
      item => item.transaction.id === groupItem.transactionId,
    );
    group.value!.groupItems[index].transaction = updatedTransaction;
    delete unsignedSignersToCheck.value[groupItem.transaction.id];

    toast.success('Transaction signed successfully');
  } catch {
    toast.error('Transaction not signed');
  } finally {
    signingItemSeq.value = -1;
  }
};

const handleSignAll = async () => {
  if (!isLoggedInOrganization(user.selectedOrganization) || !isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in organization');
  }

  const personalPassword = getPassword(handleSignAll, {
    subHeading: 'Enter your application password to decrypt your private key',
  });
  if (passwordModalOpened(personalPassword)) return;

  try {
    isSigningAll.value = true;
    const items: SignatureItem[] = [];
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
      await uploadSignatures(
        user.personal.id,
        personalPassword,
        user.selectedOrganization,
        undefined,
        undefined,
        undefined,
        items,
      );

      await handleFetchGroup(group.value!.id);
      toast.success('Transactions signed successfully');
    }
  } catch {
    toast.error('Transactions not signed');
  } finally {
    isSigningAll.value = false;
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
        await router.push({
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

const handleExportGroup = async () => {
  // This currently only exports to TTv1 format
  assertUserLoggedIn(user.personal);

  /* Verifies the user has entered his password */
  const personalPassword = getPassword(handleExportGroup, {
    subHeading: 'Enter your application password to export the transaction group',
  });
  if (passwordModalOpened(personalPassword)) return;

  if (user.publicKeys.length === 0) {
    throw new Error(
      'Exporting in the .tx format requires a signature. User must have at least one key pair to sign the transaction.',
    );
  }
  const publicKey = user.publicKeys[0]; // get the first key pair's public key

  const privateKeyRaw = await decryptPrivateKey(user.personal.id, personalPassword, publicKey);
  const privateKey = getPrivateKey(publicKey, privateKeyRaw);

  if (group.value != undefined) {
    const zip = new JSZip(); // Prepare a new ZIP archive

    for (const item of group.value.groupItems as IGroupItem[]) {
      const orgTransaction: ITransactionFull = await getTransactionById(
        user.selectedOrganization?.serverUrl || '',
        Number(item.transactionId),
      );

      const baseName = generateTransactionExportFileName(orgTransaction);

      const { signedBytes, jsonContent } = await generateTransactionExportContent(
        orgTransaction,
        privateKey,
        group.value.description,
      );

      zip.file(`${baseName}.tx`, signedBytes); // Add .tx file content to ZIP
      zip.file(`${baseName}.txt`, jsonContent); // Add .txt  file content to ZIP
    }
    // Generate the ZIP file in-memory as a Uint8Array
    const zipContent = await zip.generateAsync({ type: 'uint8array' });

    // Generate the ZIP file name
    const zipBaseName = `${group.value.description.substring(0, 25) || 'transaction-group'}`;

    // Save the ZIP file to disk
    const { filePath, canceled } = await showSaveDialog(
      `${zipBaseName}.zip`,
      'Export transaction group',
      'Export',
      [{ name: 'Transaction Tool v1 ZIP archive', extensions: ['.zip'] }],
      'Select the file to export the transaction group to:',
    );
    if (canceled || !filePath) {
      return;
    }

    // write the zip file to disk
    await saveFileToPath(zipContent, filePath);

    toast.success('Transaction exported successfully');
  }
};

/* Functions */
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

function statusIconClass(status: TransactionStatus): string {
  let result: string;
  switch (status) {
    case TransactionStatus.CANCELED:
    case TransactionStatus.EXPIRED:
      result = 'bi-x-lg text-danger';
      break;
    case TransactionStatus.REJECTED:
    case TransactionStatus.FAILED:
      result = 'bi-x-circle text-danger';
      break;
    case TransactionStatus.WAITING_FOR_EXECUTION:
      result = 'bi-check-lg text-success';
      break;
    case TransactionStatus.EXECUTED:
    case TransactionStatus.ARCHIVED:
      result = 'bi-check-circle text-success';
      break;
    case TransactionStatus.WAITING_FOR_SIGNATURES:
    default:
      result = '';
  }
  return result;
}

function tooltipText(status: TransactionStatus): string {
  let result: string;
  switch (status) {
    case TransactionStatus.CANCELED:
      result = 'Transaction has been canceled';
      break;
    case TransactionStatus.EXPIRED:
      result = 'Transaction has expired';
      break;
    case TransactionStatus.REJECTED:
      result = 'Transaction has beed rejected by the network';
      break;
    case TransactionStatus.FAILED:
      result = 'Transaction has failed';
      break;
    case TransactionStatus.WAITING_FOR_EXECUTION:
      result = 'Transaction is signed by all required signers';
      break;
    case TransactionStatus.EXECUTED:
      result = 'Transaction was succesfully executed';
      break;
    case TransactionStatus.ARCHIVED:
      result = 'Transaction was archived';
      break;
    case TransactionStatus.WAITING_FOR_SIGNATURES:
    default:
      result = '';
  }
  return result;
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
      <div class="flex-centered justify-content-between flex-wrap gap-4">
        <div class="d-flex align-items-center">
          <AppButton type="button" color="secondary" class="btn-icon-only me-4" @click="handleBack">
            <i class="bi bi-arrow-left"></i>
          </AppButton>

          <h2 class="text-title text-bold">Transaction Group Details</h2>
        </div>

        <AppButton
          type="button"
          color="secondary"
          @click.prevent="handleExportGroup"
          data-testid="button-export-group"
          ><span>Export</span>
        </AppButton>
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
                        <th></th>
                        <th>
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
                              <td class="pe-0 ps-3">
                                <span
                                  v-if="groupItem.transaction.status"
                                  data-bs-toggle="tooltip"
                                  data-bs-custom-class="wide-tooltip"
                                  data-bs-trigger="hover"
                                  data-bs-placement="top"
                                  :title="tooltipText(groupItem.transaction.status)"
                                  ref="tooltipRef"
                                  class="bi fs-5"
                                  :class="statusIconClass(groupItem.transaction.status)"
                                ></span>
                              </td>
                              <td data-testid="td-group-transaction-id">
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
                                <div class="d-flex justify-content-center flex-wrap gap-3">
                                  <AppButton
                                    :loading="signingItemSeq === groupItem.seq"
                                    loading-text="Signing..."
                                    type="button"
                                    color="primary"
                                    @click.prevent="handleSignGroupItem(groupItem as IGroupItem)"
                                    :data-testid="`sign-group-item-${index}`"
                                    :disabled="
                                      unsignedSignersToCheck[groupItem.transaction.id] ===
                                        undefined ||
                                      groupItem.transaction.status !==
                                        TransactionStatus.WAITING_FOR_SIGNATURES
                                    "
                                    ><span>Sign</span>
                                  </AppButton>
                                  <AppButton
                                    type="button"
                                    color="secondary"
                                    @click.prevent="handleDetails(groupItem.transaction.id)"
                                    :data-testid="`button-group-transaction-${index}`"
                                    ><span>Details</span>
                                  </AppButton>
                                </div>
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
              <template v-if="shouldApprove || showSignAll">
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
                  <template v-if="showSignAll">
                    <AppButton
                      color="primary"
                      type="button"
                      :loading="isSigningAll"
                      loading-text="Signing..."
                      data-testid="button-sign-all-tx"
                      @click="handleSignAll"
                      :disabled="disableSignAll"
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      :title="
                        disableSignAll
                          ? 'Cannot sign all due to transaction version mismatch.'
                          : 'Sign all transactions.'
                      "
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
