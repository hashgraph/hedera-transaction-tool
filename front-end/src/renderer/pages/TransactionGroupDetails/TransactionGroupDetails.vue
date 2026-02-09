<script setup lang="ts">
import type { IGroup } from '@renderer/services/organization';
import { BackEndTransactionType, type IGroupItem, type ITransactionFull } from '@shared/interfaces';
import { TransactionStatus, TransactionTypeName } from '@shared/interfaces';

import { computed, onBeforeMount, reactive, ref, watch, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import { Transaction } from '@hashgraph/sdk';
import JSZip from 'jszip';
import { historyTitle, TRANSACTION_ACTION } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useNextTransactionV2 from '@renderer/stores/storeNextTransactionV2.ts';

import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import useWebsocketSubscription from '@renderer/composables/useWebsocketSubscription';

import { areByteArraysEqual } from '@shared/utils/byteUtils';

import {
  getTransactionById,
  getTransactionGroupById,
  getUserShouldApprove,
  sendApproverChoice,
  cancelTransaction,
} from '@renderer/services/organization';
import { decryptPrivateKey } from '@renderer/services/keyPairService';
import { saveFileToPath, showSaveDialog } from '@renderer/services/electronUtilsService.ts';

import {
  getPrivateKey,
  getTransactionBodySignatureWithoutNodeAccountId,
  hexToUint8Array,
  isLoggedInOrganization,
  isUserLoggedIn,
  usersPublicRequiredToSign,
  assertUserLoggedIn,
  signTransactions,
  getErrorMessage,
  assertIsLoggedInOrganization,
  getStatusFromCode,
  generateTransactionExportFileName,
  generateTransactionV1ExportContent,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import DateTimeString from '@renderer/components/ui/DateTimeString.vue';
import useContactsStore from '@renderer/stores/storeContacts.ts';
import AppDropDown from '@renderer/components/ui/AppDropDown.vue';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';
import {
  formatTransactionType,
  getTransactionTypeFromBackendType,
} from '@renderer/utils/sdk/transactions.ts';
import TransactionId from '@renderer/components/ui/TransactionId.vue';
import NextTransactionCursor from '@renderer/components/NextTransactionCursor.vue';

/* Types */
type ActionButton = 'Reject All' | 'Approve All' | 'Sign All' | 'Cancel All' | 'Export';

/* Misc */
const reject: ActionButton = 'Reject All';
const approve: ActionButton = 'Approve All';
const sign: ActionButton = 'Sign All';
const cancel: ActionButton = 'Cancel All';
const exportName: ActionButton = 'Export';

const primaryButtons: ActionButton[] = [reject, approve, sign];
const buttonsDataTestIds: { [key: string]: string } = {
  [reject]: 'button-reject-group',
  [approve]: 'button-approve-group',
  [sign]: 'button-sign-group',
  [cancel]: 'button-cancel-group',
  [exportName]: 'button-export-group',
};

/* Stores */
const user = useUserStore();
const network = useNetwork();
const nextTransaction = useNextTransactionV2();
const contacts = useContactsStore();

/* Composables */
const router = useRouter();
const toast = useToast();
useWebsocketSubscription(TRANSACTION_ACTION, async () => {
  const id = router.currentRoute.value.params.id;
  await fetchGroup(Array.isArray(id) ? id[0] : id);
});
useSetDynamicLayout(LOGGED_IN_LAYOUT);
const { getPassword, passwordModalOpened } = usePersonalPassword();
const createTooltips = useCreateTooltips();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();

/* State */
const group = ref<IGroup | null>(null);
const shouldApprove = ref(false);
const isVersionMismatch = ref(false);
const signingItems = ref<boolean[]>([]); // is signing in progress for a group item
const unsignedSignersToCheck = ref<Record<number, string[]>>({});
const tooltipRef = ref<HTMLElement[]>([]);
const isConfirmModalShown = ref(false);
const confirmModalTitle = ref('');
const confirmModalText = ref('');
const confirmCallback = ref<((...args: any[]) => void) | null>(null);

const fullyLoaded = ref(false);
const loadingStates = reactive<{ [key: string]: string | null }>({
  [reject]: null,
  [approve]: null,
  [sign]: null,
  [cancel]: null,
});

/* Computed */
const pageTitle = computed(() => {
  let txType: BackEndTransactionType | null = null;
  let result: string | null = null;

  if (group.value) {
    if (group.value.groupItems.length >= 1) {
      txType = group.value.groupItems[0].transaction.type;
      for (const item of group.value.groupItems.slice(1)) {
        if (item.transaction.type !== txType) {
          txType = null;
          break;
        }
      }
      result = `Group of ${group.value.groupItems.length}`;
      if (txType) {
        result += ` ${getTransactionTypeFromBackendType(txType, false, true)}`;
      }
      result += (group.value.groupItems.length > 1) ? ' transactions' : ' transaction';
    }
  }
  return result;
});

const description = computed(() => {
  return group.value ? group.value.description : null;
});

const isSequential = computed(() => {
  return group.value?.sequential ?? false;
});

const canSignAll = computed(() => {
  return (
    isLoggedInOrganization(user.selectedOrganization) &&
    !isVersionMismatch.value &&
    Object.keys(unsignedSignersToCheck.value).length >= 1
  );
});

const isCreator = computed(() => {
  const creator = contacts.contacts.find(contact =>
    contact.userKeys.some(k => k.id === group.value?.groupItems[0].transaction.creatorKeyId),
  );
  return (
    isLoggedInOrganization(user.selectedOrganization) &&
    creator &&
    creator.user.id === user.selectedOrganization.userId
  );
});

const groupIsInProgress = computed(() => {
  let result = false;
  for (const item of group.value?.groupItems ?? []) {
    if (isTransactionInProgress(item.transaction as ITransactionFull)) {
      result = true;
      break;
    }
  }
  return result;
});

const canCancelAll = computed(() => {
  return isCreator.value && groupIsInProgress.value;
});

const visibleButtons = computed(() => {
  const buttons: ActionButton[] = [];

  if (!fullyLoaded.value) return buttons;

  /* The order is important REJECT, APPROVE, SIGN, CANCEL, EXPORT */
  shouldApprove.value && buttons.push(reject, approve);
  canSignAll.value && !shouldApprove.value && buttons.push(sign);
  canCancelAll.value && buttons.push(cancel);
  buttons.push(exportName);

  return buttons;
});

const dropDownItems = computed(() =>
  visibleButtons.value.slice(1).map(item => ({ label: item, value: item })),
);

/* Handlers */
const handleBack = async () => {
  await nextTransaction.routeUp(router);
};

const handleDetails = async (id: number) => {
  // Before routing to details, we update nextTransaction store
  const groupItems = group.value?.groupItems ?? [];
  const nodeIds = groupItems.map(item => {
    return { transactionId: item.transactionId };
  });
  await nextTransaction.routeDown({ transactionId: id }, nodeIds, router);
};

const handleSignGroupItem = async (groupItem: IGroupItem) => {
  const personalPassword = getPassword(handleSignGroupItem.bind(null, groupItem), {
    subHeading: 'Enter your application password to decrypt your private key',
  });
  if (passwordModalOpened(personalPassword)) return;

  try {
    signingItems.value[groupItem.seq] = true;

    const signed = await signTransactions(
      [groupItem.transaction],
      personalPassword,
      accountByIdCache,
      nodeByIdCache,
    );

    if (signed) {
      const updatedTransaction: ITransactionFull = await getTransactionById(
        user.selectedOrganization?.serverUrl || '',
        groupItem.transactionId,
      );

      const index = group.value!.groupItems.findIndex(
        item => item.transaction.id === groupItem.transactionId,
      );
      group.value!.groupItems[index].transaction = updatedTransaction;
      delete unsignedSignersToCheck.value[groupItem.transaction.id];
      toast.success('Transaction signed successfully', successToastOptions);
    } else {
      toast.error('Failed to sign transaction', errorToastOptions);
    }
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to sign transaction'), errorToastOptions);
  } finally {
    signingItems.value[groupItem.seq] = false;
  }
};

const handleCancelAll = async (showModal = false) => {
  if (showModal) {
    isConfirmModalShown.value = true;
    confirmModalTitle.value = 'Cancel all transactions?';
    confirmModalText.value = 'Are you sure you want to cancel all transactions?';
    confirmCallback.value = handleCancelAll;
    return;
  }

  isConfirmModalShown.value = false;

  if (!isLoggedInOrganization(user.selectedOrganization) || !isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in organization');
  }

  try {
    loadingStates[cancel] = 'Canceling...';
    if (group.value != undefined) {
      for (const groupItem of group.value.groupItems) {
        if (isTransactionInProgress(groupItem.transaction as ITransactionFull)) {
          await cancelTransaction(user.selectedOrganization.serverUrl, groupItem.transaction.id);
        }
      }
    }

    await fetchGroup(group.value!.id);
    toast.success('Transactions canceled successfully', successToastOptions);
  } catch {
    toast.error('Transactions not canceled', errorToastOptions);
  } finally {
    loadingStates[cancel] = null;
  }
};

const handleSignAll = async (showModal = false) => {
  if (showModal) {
    isConfirmModalShown.value = true;
    confirmModalTitle.value = 'Sign all transactions?';
    confirmModalText.value = 'Are you sure you want to sign all transactions?';
    confirmCallback.value = handleSignAll;
    return;
  }
  isConfirmModalShown.value = false;

  const personalPassword = getPassword(handleSignAll.bind(null, showModal), {
    subHeading: 'Enter your application password to decrypt your private key',
  });
  if (passwordModalOpened(personalPassword)) return;
  assertIsLoggedInOrganization(user.selectedOrganization);

  try {
    loadingStates[sign] = 'Signing...';

    let itemsToSign = group.value?.groupItems.map(item => item.transaction) ?? [];
    itemsToSign = itemsToSign.filter(
      item => item.status === TransactionStatus.WAITING_FOR_SIGNATURES,
    );
    const signed = await signTransactions(
      itemsToSign,
      personalPassword,
      accountByIdCache,
      nodeByIdCache,
    );
    await fetchGroup(group.value!.id);

    if (signed) {
      toast.success('Transactions signed successfully', successToastOptions);
    } else {
      toast.error('Transactions not signed', errorToastOptions);
    }
  } catch {
    toast.error('Transactions not signed', errorToastOptions);
  } finally {
    loadingStates[sign] = null;
  }
};

const handleApproveAll = async (showModal = false, approved = false) => {
  if (!approved && showModal) {
    isConfirmModalShown.value = true;
    confirmModalTitle.value = 'Reject all Transactions?';
    confirmModalText.value = 'Are you sure you want to reject all transactions?';
    confirmCallback.value = handleApproveAll;
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
      loadingStates[approve] = 'Approving...';

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
      toast.success(
        `Transactions ${approved ? 'approved' : 'rejected'} successfully`,
        successToastOptions,
      );

      if (!approved) {
        await router.push({
          name: 'transactions',
          query: {
            tab: historyTitle,
          },
        });
      }
    } finally {
      loadingStates[approve] = null;
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

      const { signedBytes, jsonContent } = await generateTransactionV1ExportContent(
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

    toast.success('Transaction exported successfully', successToastOptions);
  }
};

const handleAction = async (value: ActionButton) => {
  if (value === reject) {
    await handleApproveAll(true, false);
  } else if (value === approve) {
    await handleApproveAll(true, true);
  } else if (value === sign) {
    await handleSignAll(true);
  } else if (value === cancel) {
    await handleCancelAll(true);
  } else if (value === exportName) {
    await handleExportGroup();
  }
};

const handleSubmit = async (e: Event) => {
  const buttonContent = (e as SubmitEvent).submitter?.textContent || '';
  await handleAction(buttonContent as ActionButton);
};

const handleDropDownItem = async (value: ActionButton) => handleAction(value);

/* Hooks */
onBeforeMount(async () => {
  const id = router.currentRoute.value.params.id;
  if (!id) {
    router.back();
    return;
  }

  await fetchGroup(Array.isArray(id) ? id[0] : id);
});

/* Watchers */
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

/* Functions */
async function fetchGroup(id: string | number) {
  fullyLoaded.value = false;
  if (isLoggedInOrganization(user.selectedOrganization) && !isNaN(Number(id))) {
    try {
      const updatedUnsignedSignersToCheck: Record<number, string[]> = {};

      group.value = await getTransactionGroupById(user.selectedOrganization.serverUrl, Number(id));
      isVersionMismatch.value = false;

      if (group.value?.groupItems != undefined) {
        for (const item of group.value.groupItems) {
          const transactionBytes = hexToUint8Array(item.transaction.transactionBytes);
          const tx = Transaction.fromBytes(transactionBytes);

          const isTransactionVersionMismatch = !areByteArraysEqual(tx.toBytes(), transactionBytes);
          if (isTransactionVersionMismatch) {
            toast.error('Transaction version mismatch. Cannot sign all.', errorToastOptions);
            isVersionMismatch.value = true;
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
            accountByIdCache,
            nodeByIdCache,
            user.selectedOrganization,
          );

          if (
            item.transaction.status !== TransactionStatus.CANCELED &&
            item.transaction.status !== TransactionStatus.EXPIRED &&
            usersPublicKeys.length > 0
          ) {
            updatedUnsignedSignersToCheck[txId] = usersPublicKeys;
          }
        }
        signingItems.value = Array(group.value.groupItems.length).fill(false);
        fullyLoaded.value = true;
      }

      unsignedSignersToCheck.value = updatedUnsignedSignersToCheck;

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

const isTransactionInProgress = (transaction: ITransactionFull) => {
  return [
    TransactionStatus.NEW,
    TransactionStatus.WAITING_FOR_EXECUTION,
    TransactionStatus.WAITING_FOR_SIGNATURES,
  ].includes(transaction.status);
};

const canSignItem = (item: IGroupItem) => {
  return (
    !signingItems.value[item.seq] &&
    unsignedSignersToCheck.value[item.transaction.id] &&
    item.transaction.status === TransactionStatus.WAITING_FOR_SIGNATURES
  );
};

const makeItemStatus = (item: IGroupItem) => {
  let result: string;
  const status = item.transaction.status;
  const statusCode = item.transaction.statusCode;

  if (statusCode) {
    // Transaction has been executed
    result = getStatusFromCode(statusCode) ?? '';
  } else {
    switch (status) {
      case TransactionStatus.WAITING_FOR_SIGNATURES:
        result = canSignItem(item) ? 'READY TO SIGN' : 'IN PROGRESS';
        break;
      case TransactionStatus.WAITING_FOR_EXECUTION:
        result = 'READY FOR EXECUTION';
        break;
      case TransactionStatus.EXECUTED:
        result = 'EXECUTED';
        break;
      case TransactionStatus.CANCELED:
        result = 'CANCELED';
        break;
      case TransactionStatus.EXPIRED:
        result = 'EXPIRED';
        break;
      case TransactionStatus.REJECTED:
        result = 'REJECTED';
        break;
      case TransactionStatus.ARCHIVED:
        result = 'ARCHIVED';
        break;
      default:
        result = status;
    }
  }
  return result;
};

function itemStatusBadgeClass(item: IGroupItem): string {
  let result: string;
  const status = item.transaction.status;
  const statusCode = item.transaction.statusCode;
  if (statusCode) {
    result = [0, 22, 104].includes(statusCode) ? 'bg-success' : 'bg-danger';
  } else {
    switch (status) {
      case TransactionStatus.WAITING_FOR_EXECUTION:
        result = 'bg-success-subtle text-success-emphasis border border-success-subtle';
        break;
      case TransactionStatus.ARCHIVED:
        result = 'bg-success';
        break;
      case TransactionStatus.EXPIRED:
      case TransactionStatus.CANCELED:
      case TransactionStatus.REJECTED:
        result = 'bg-danger';
        break;
      case TransactionStatus.WAITING_FOR_SIGNATURES:
        result = canSignItem(item) ? 'bg-info' : 'text-muted';
        break;
      default:
        result = 'text-muted';
    }
  }
  return result;
}
</script>
<template>
  <form @submit.prevent="handleSubmit" class="p-5">
    <div class="flex-column-100">
      <div class="flex-centered justify-content-between flex-wrap gap-4">
        <div class="d-flex align-items-center gap-4 flex-1">
          <AppButton type="button" color="secondary" class="btn-icon-only" @click="handleBack">
            <i class="bi bi-arrow-left"></i>
          </AppButton>
          <NextTransactionCursor />

            <Transition mode="out-in" name="fade">
              <template v-if="pageTitle">
                <h2 class="text-title text-bold flex-1 text-one-line-ellipsis">
                  {{ pageTitle }}
                </h2>
              </template>
            </Transition>
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
                  >{{ visibleButtons[0] }}
                </AppButton>
              </div>
            </template>
          </Transition>

          <Transition name="fade" mode="out-in">
            <template v-if="dropDownItems.length > 0">
              <div>
                <AppDropDown
                  :color="'secondary'"
                  :items="dropDownItems"
                  compact
                  @select="handleDropDownItem($event as ActionButton)"
                  data-testid="button-more-dropdown-lg"
                />
              </div>
            </template>
          </Transition>
        </div>
      </div>

      <Transition name="fade" mode="out-in">
        <template v-if="group">
          <div class="fill-remaining flex-column-100 mt-5">
            <div class="mt-5">
              <label class="form-label">Transaction Group Description</label>
              <div>{{ description }}</div>
            </div>

            <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="mt-5">
              <label class="form-label">Sequential Execution</label>
              <div>{{ isSequential ? 'Yes' : 'No' }}</div>
            </div>

            <hr class="separator my-5 w-100" />

            <Transition name="fade" mode="out-in">
              <template v-if="group.groupItems.length > 0">
                <div class="fill-remaining overflow-x-auto">
                  <table class="table-custom">
                    <thead>
                      <tr>
                        <th>Transaction ID</th>
                        <th>Transaction Type</th>
                        <th>Status</th>
                        <th>Valid Start</th>
                        <th class="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <template v-for="(groupItem, index) in group.groupItems" :key="groupItem.seq">
                        <Transition name="fade" mode="out-in">
                          <template v-if="groupItem">
                            <tr>
                              <!-- Column #1 : Transaction ID -->
                              <td data-testid="td-group-transaction-id">
                                <TransactionId
                                  :transaction-id="groupItem.transaction.transactionId"
                                  wrap
                                />
                              </td>
                              <!-- Column #2 : Transaction Type -->
                              <td>
                                <span class="text-bold">{{
                                  formatTransactionType(
                                    TransactionTypeName[groupItem.transaction.type],
                                    false,
                                    true,
                                  )
                                }}</span>
                              </td>
                              <!-- Column #3 : Status -->
                              <td :data-testid="`td-transaction-node-transaction-status-${index}`">
                                <span
                                  :class="itemStatusBadgeClass(groupItem as IGroupItem)"
                                  class="badge text-break"
                                  >{{ makeItemStatus(groupItem as IGroupItem) }}</span
                                >
                              </td>
                              <!-- Column #4 : Valid Start -->
                              <td data-testid="td-group-valid-start-time">
                                <DateTimeString
                                  :date="new Date(groupItem.transaction.validStart)"
                                  compact
                                  wrap
                                />
                              </td>
                              <!-- Column #5 : Actions -->
                              <td class="text-center">
                                <div class="d-flex justify-content-center gap-4">
                                  <AppButton
                                    :disabled="!canSignItem(groupItem as IGroupItem)"
                                    loading-text="Sign"
                                    type="button"
                                    color="primary"
                                    @click.prevent="handleSignGroupItem(groupItem as IGroupItem)"
                                    :data-testid="`sign-group-item-${index}`"
                                    :loading="signingItems[groupItem.seq]"
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

            <AppConfirmModal
              v-model:show="isConfirmModalShown"
              :title="confirmModalTitle"
              :text="confirmModalText"
              :callback="confirmCallback"
            />
          </div>
        </template>
        <template v-else>
          <div class="flex-column-100 justify-content-center">
            <AppLoader class="mb-7" />
          </div>
        </template>
      </Transition>
    </div>
  </form>
</template>
