<script setup lang="ts">
import type { IGroup, IGroupItem } from '@renderer/services/organization';
import {
  getTransactionById,
  getTransactionGroupById,
  getUserShouldApprove,
  sendApproverChoice,
} from '@renderer/services/organization';
import {
  BackEndTransactionType,
  type INotificationReceiver,
  type ITransactionFull,
  NotificationType,
} from '@shared/interfaces';

import { computed, onBeforeMount, reactive, ref, watch, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import { ToastManager } from '@renderer/utils/ToastManager';

import { Transaction } from '@hashgraph/sdk';
import JSZip from 'jszip';
import { FEATURE_APPROVERS_ENABLED, historyTitle, TRANSACTION_ACTION } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useNextTransactionV2 from '@renderer/stores/storeNextTransactionV2.ts';

import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import useWebsocketSubscription from '@renderer/composables/useWebsocketSubscription';
import { parseTransactionActionPayload } from '@renderer/utils/parseTransactionActionPayload';

import { areByteArraysEqual } from '@shared/utils/byteUtils';
import { decryptPrivateKey } from '@renderer/services/keyPairService';
import { saveFileToPath, showSaveDialog } from '@renderer/services/electronUtilsService.ts';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  generateTransactionExportFileName,
  generateTransactionV1ExportContent,
  getPrivateKey,
  getTransactionBodySignatureWithoutNodeAccountId,
  hexToUint8Array,
  isLoggedInOrganization,
  isSignableTransaction,
  isUserLoggedIn,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import useContactsStore from '@renderer/stores/storeContacts.ts';
import AppDropDown from '@renderer/components/ui/AppDropDown.vue';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { getTransactionTypeFromBackendType } from '@renderer/utils/sdk/transactions.ts';
import NextTransactionCursor from '@renderer/components/NextTransactionCursor.vue';
import BreadCrumb from '@renderer/components/BreadCrumb.vue';
import useNotificationsStore from '@renderer/stores/storeNotifications.ts';
import { PublicKeyOwnerCache } from '@renderer/caches/backend/PublicKeyOwnerCache.ts';
import { isInProgressStatus } from '@renderer/utils/transactionStatusGuards.ts';
import TransactionGroupRow from '@renderer/pages/TransactionGroupDetails/TransactionGroupRow.vue';
import SignAllController from '@renderer/pages/TransactionGroupDetails/SignAllController.vue';
import CancelAllController from '@renderer/pages/TransactionGroupDetails/CancelAllController.vue';

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
const notifications = useNotificationsStore();

/* Composables */
const router = useRouter();
useWebsocketSubscription(TRANSACTION_ACTION, async (payload?: unknown) => {
  const parsed = parseTransactionActionPayload(payload);
  const id = router.currentRoute.value.params.id;
  const groupId = Number(Array.isArray(id) ? id[0] : id);
  if (!parsed) { await fetchGroup(groupId); return; } // Legacy fallback

  // If initial fetch hasn't completed yet, fall back to a full refetch
  if (!group.value) {
    await fetchGroup(groupId);
    return;
  }

  const isAffected = parsed.groupIds.includes(groupId) ||
    (group.value.groupItems?.some(item =>
      parsed.transactionIds.includes(item.transactionId),
    ) ?? false);
  if (isAffected) await fetchGroup(groupId);
});
useSetDynamicLayout(LOGGED_IN_LAYOUT);
const { getPassword, passwordModalOpened } = usePersonalPassword();
const createTooltips = useCreateTooltips();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();
const publicKeyOwnerCache = PublicKeyOwnerCache.inject();
const toastManager = ToastManager.inject();

/* State */
const group = ref<IGroup | null>(null);
const firstSignableGroupItem = ref<IGroupItem | null>(null);
const signAllStarted = ref(false);
const cancelAllStarted = ref(false);
const shouldApprove = ref(false);
const isVersionMismatch = ref(false);
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
const groupId = computed(() => {
  const id = Number(router.currentRoute.value.params.id);
  return Number.isNaN(id) ? null : id;
});

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
      result += group.value.groupItems.length > 1 ? ' transactions' : ' transaction';
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
    firstSignableGroupItem.value !== null
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
  return group.value?.groupItems?.some(item =>
    isInProgressStatus(item.transaction.status),
  ) ?? false;
});

const canCancelAll = computed(() => {
  return isCreator.value && groupIsInProgress.value;
});

const visibleButtons = computed(() => {
  const buttons: ActionButton[] = [];

  if (!fullyLoaded.value) return buttons;

  /* The order is important REJECT, APPROVE, SIGN, CANCEL, EXPORT */
  FEATURE_APPROVERS_ENABLED && shouldApprove.value && buttons.push(reject, approve);
  canSignAll.value && !(FEATURE_APPROVERS_ENABLED && shouldApprove.value) && buttons.push(sign);
  canCancelAll.value && buttons.push(cancel);
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

const handleDetails = async (id: number) => {
  // Before routing to details, we update nextTransaction store
  const groupItems = group.value?.groupItems ?? [];
  const nodeIds = groupItems.map(item => {
    return { transactionId: item.transactionId };
  });
  await nextTransaction.routeDown({ transactionId: id }, nodeIds, router, pageTitle.value);
};

const handleCancelAll = async () => {
  cancelAllStarted.value = true;
};

const didCancelAll = async (groupId: number) => {
  await fetchGroup(groupId);
};

const handleSignAll = () => {
  signAllStarted.value = true;
};

const didSignAll = async (groupId: number | null /*, signed: boolean */) => {
  if (groupId !== null) {
    await fetchGroup(groupId);
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
      throw new Error('You must be logged in to cancel transactions.');
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
      toastManager.success(`Transactions ${approved ? 'approved' : 'rejected'} successfully`);

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

      const { transactionBytes, jsonContent } = await generateTransactionV1ExportContent(
        orgTransaction,
        privateKey,
        group.value.description,
      );

      zip.file(`${baseName}.tx`, transactionBytes); // Add .tx file content to ZIP
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

    toastManager.success('Transaction exported successfully');
  }
};

const handleAction = async (value: ActionButton) => {
  if (value === reject) {
    await handleApproveAll(true, false);
  } else if (value === approve) {
    await handleApproveAll(true, true);
  } else if (value === sign) {
    handleSignAll();
  } else if (value === cancel) {
    await handleCancelAll();
  } else if (value === exportName) {
    await handleExportGroup();
  }
};

const handleSubmit = async (e: Event) => {
  const buttonContent = (e as SubmitEvent).submitter?.textContent || '';
  await handleAction(buttonContent as ActionButton);
};

const handleDropDownItem = async (value: ActionButton) => handleAction(value);

const didSignTransaction = async (updatedTransaction: ITransactionFull) => {
  const transactionId = updatedTransaction.id;
  if (group.value) {
    const index = group.value.groupItems.findIndex(item => item.transaction.id === transactionId);
    if (index != -1) {
      group.value.groupItems[index].transaction = updatedTransaction;
    } // else bug : leaves transaction unchanged
  } // else bug : ignores silently
  await updateFirstSignableGroupItemAfterSign(updatedTransaction.id);
};

const updateFirstSignableGroupItemAfterFetch = async () => {
  assertIsLoggedInOrganization(user.selectedOrganization);
  firstSignableGroupItem.value = null;
  const groupItems = group.value?.groupItems ?? [];
  for (const item of [...groupItems].reverse()) {
    const signable = await isSignableTransaction(
      item.transaction,
      network.mirrorNodeBaseURL,
      accountByIdCache,
      nodeByIdCache,
      publicKeyOwnerCache,
      user.selectedOrganization,
    );
    if (signable) {
      firstSignableGroupItem.value = item;
      break;
    }
  }
};

const updateFirstSignableGroupItemAfterSign = async (transactionId: number) => {
  if (transactionId === firstSignableGroupItem.value?.transactionId) {
    await updateFirstSignableGroupItemAfterFetch();
  } // else leaves firstSignableGroupItem unchanged because it's valid
};

/* Hooks */
onBeforeMount(async () => {
  if (groupId.value !== null) {
    await fetchGroup(groupId.value);
  } else {
    router.back();
  }
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
      group.value = await getTransactionGroupById(user.selectedOrganization.serverUrl, Number(id));
      isVersionMismatch.value = false;

      if (group.value?.groupItems != undefined) {
        for (const item of group.value.groupItems) {
          const transactionBytes = hexToUint8Array(item.transaction.transactionBytes);
          const tx = Transaction.fromBytes(transactionBytes);

          const isTransactionVersionMismatch = !areByteArraysEqual(tx.toBytes(), transactionBytes);
          if (isTransactionVersionMismatch) {
            toastManager.error('Transaction version mismatch. Cannot sign all.');
            isVersionMismatch.value = true;
            break;
          }

          if (FEATURE_APPROVERS_ENABLED) {
            shouldApprove.value =
              shouldApprove.value ||
              (await getUserShouldApprove(
                user.selectedOrganization.serverUrl,
                item.transaction.id,
              ));
          }
        }
        fullyLoaded.value = true;

        const notificationIds = notifications.currentOrganizationNotifications
          .filter((n: INotificationReceiver) => {
            const notificationGroupId = n.notification.additionalData?.groupId;

            return (
              n.notification.type === NotificationType.TRANSACTION_INDICATOR_SIGN &&
              notificationGroupId === Number(id)
            );
          })
          .map(n => n.id);

        if (notificationIds.length > 0) {
          await notifications.markAsReadIds(notificationIds);
        }
      }

      await updateFirstSignableGroupItemAfterFetch();

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

</script>
<template>
  <form @submit.prevent="handleSubmit" class="p-5">
    <div class="flex-column-100">
      <div class="d-flex flex-column">
        <div class="flex-centered justify-content-between flex-wrap gap-4">
          <div class="d-flex align-items-center gap-4 flex-1">
            <AppButton
              v-if="flatBreadCrumb"
              class="btn-icon-only"
              color="secondary"
              type="button"
              @click="handleBack"
            >
              <i class="bi bi-arrow-left"></i>
            </AppButton>
            <BreadCrumb v-if="pageTitle" :leaf="pageTitle" />
          </div>

          <div class="flex-centered gap-4">
            <NextTransactionCursor />
            <Transition name="fade" mode="out-in">
              <template v-if="visibleButtons.length > 0">
                <div>
                  <AppButton
                    :color="primaryButtons.includes(visibleButtons[0]) ? 'primary' : 'secondary'"
                    :disabled="Boolean(loadingStates[visibleButtons[0]])"
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
                        <TransactionGroupRow
                          :group-item="groupItem"
                          :row-index="index"
                          @handle-details="handleDetails"
                          @transaction-signed="didSignTransaction"
                        />
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

            <SignAllController
              v-model:activate="signAllStarted"
              :groupOrId="group"
              :callback="didSignAll"
            />

            <CancelAllController
              v-model:activate="cancelAllStarted"
              :groupOrId="group"
              :callback="didCancelAll"
            />

            <AppConfirmModal
              v-model:show="isConfirmModalShown"
              data-testid="button-group-action"
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
