<script lang="ts" setup>
import type { IGroup, IGroupItem } from '@renderer/services/organization';
import { getTransactionGroupById, getUserShouldApprove } from '@renderer/services/organization';
import { createLogger } from '@renderer/utils/logger';
import {
  BackEndTransactionType,
  type INotificationReceiver,
  type ITransactionFull,
  NotificationType,
} from '@shared/interfaces';

import { computed, onBeforeMount, reactive, ref, watch, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import { ToastManager } from '@renderer/utils/ToastManager';

import { Transaction } from '@hiero-ledger/sdk';
import { FEATURE_APPROVERS_ENABLED, TRANSACTION_ACTION } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import useNextTransactionV2 from '@renderer/stores/storeNextTransactionV2.ts';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import useWebsocketSubscription from '@renderer/composables/useWebsocketSubscription';
import { parseTransactionActionPayload } from '@renderer/utils/parseTransactionActionPayload';

import { areByteArraysEqual } from '@shared/utils/byteUtils';

import {
  assertIsLoggedInOrganization,
  hexToUint8Array,
  isLoggedInOrganization,
  isSignableTransaction,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
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
import ExportAllController from '@renderer/pages/TransactionGroupDetails/ExportAllController.vue';
import ApproveAllController from '@renderer/pages/TransactionGroupDetails/ApproveAllController.vue';
import { BackendTransactionCache } from '@renderer/caches/backend/BackendTransactionCache';

/* Types */
type ActionButton = 'Reject All' | 'Approve All' | 'Sign All' | 'Cancel All' | 'Export All';

const logger = createLogger('renderer.page.transactionGroupDetails');

/* Misc */
const reject: ActionButton = 'Reject All';
const approve: ActionButton = 'Approve All';
const sign: ActionButton = 'Sign All';
const cancel: ActionButton = 'Cancel All';
const exportName: ActionButton = 'Export All';

const primaryButtons: ActionButton[] = [reject, approve, sign];
const buttonsDataTestIds: { [key: string]: string } = {
  [reject]: 'button-reject-group',
  [approve]: 'button-approve-group',
  [sign]: 'button-sign-group',
  [cancel]: 'button-cancel-group',
  [exportName]: 'button-export-group',
};

/* Injected */
const transactionCache = BackendTransactionCache.inject();

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
  if (!parsed) {
    await fetchGroupOnNotif(groupId);
    return;
  } // Legacy fallback

  // If initial fetch hasn't completed yet, fall back to a full refetch
  if (!group.value) {
    await fetchGroupOnNotif(groupId);
    return;
  }

  const isAffected =
    parsed.groupIds.includes(groupId) ||
    (group.value.groupItems?.some(item => parsed.transactionIds.includes(item.transactionId)) ??
      false);
  if (isAffected) await fetchGroupOnNotif(groupId);
});
useSetDynamicLayout(LOGGED_IN_LAYOUT);
const createTooltips = useCreateTooltips();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();
const publicKeyOwnerCache = PublicKeyOwnerCache.inject();
const toastManager = ToastManager.inject();

/* State */
const group = ref<IGroup | null>(null);
const firstSignableGroupItem = ref<IGroupItem | null>(null);

const shouldApprove = ref(false);
const isVersionMismatch = ref(false);
const tooltipRef = ref<HTMLElement[]>([]);

const fullyLoaded = ref(false);
const loadingStates = reactive<{ [key: string]: string | null }>({
  [reject]: null,
  [approve]: null,
  [sign]: null,
  [cancel]: null,
});

const signAllStarted = ref(false);
const cancelAllStarted = ref(false);
const exportAllStarted = ref(false);
const approveAllStarted = ref(false);
const isApproved = ref(false);

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
  return (
    group.value?.groupItems?.some(item => isInProgressStatus(item.transaction.status)) ?? false
  );
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
  await router.push({ name: 'transactions', query: { tab: router.previousTab ?? undefined } });
};

const handleDetails = async (id: number) => {
  // Before routing to details, we update nextTransaction store
  const groupItems = group.value?.groupItems ?? [];
  const nodeIds = groupItems.map(item => {
    return { transactionId: item.transactionId };
  });
  await nextTransaction.routeDown({ transactionId: id }, nodeIds, router, pageTitle.value);
};

const didSignAll = async (groupId: number | null /*, signed: boolean */) => {
  if (groupId !== null) {
    await fetchGroup(groupId);
  }
};

const handleAction = async (value: ActionButton) => {
  switch (value) {
    case reject:
    case approve:
      approveAllStarted.value = true;
      isApproved.value = value === approve;
      break;
    case sign:
      signAllStarted.value = true;
      break;
    case cancel:
      cancelAllStarted.value = true;
      break;
    case exportName:
      exportAllStarted.value = true;
      break;
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
    logger.info('Not logged into org');
  }
}

async function fetchGroupOnNotif(groupId: string | number) {
  // 1) Before calling fetchGroup(), we clear transaction cache
  if (isLoggedInOrganization(user.selectedOrganization) && group.value !== null) {
    const serverUrl = user.selectedOrganization.serverUrl;
    for (const item of group.value.groupItems) {
      // We clear cache with strict==false to keep young data
      transactionCache.forget(item.transactionId, serverUrl, false);
    }
  }
  // 2) Now fetch group
  await fetchGroup(groupId);
}
</script>
<template>
  <form class="p-5" @submit.prevent="handleSubmit">
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
            <Transition mode="out-in" name="fade">
              <template v-if="visibleButtons.length > 0">
                <div>
                  <AppButton
                    :color="primaryButtons.includes(visibleButtons[0]) ? 'primary' : 'secondary'"
                    :data-testid="buttonsDataTestIds[visibleButtons[0]]"
                    :disabled="Boolean(loadingStates[visibleButtons[0]])"
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
      </div>

      <Transition mode="out-in" name="fade">
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

            <Transition mode="out-in" name="fade">
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

            <CancelAllController
              v-model:activate="cancelAllStarted"
              :callback="fetchGroup"
              :groupOrId="group"
            />
            <ApproveAllController
              v-model:activate="approveAllStarted"
              :approved="isApproved"
              :callback="fetchGroup"
              :groupOrId="group"
            />
            <SignAllController
              v-model:activate="signAllStarted"
              :callback="didSignAll"
              :groupOrId="group"
            />
            <ExportAllController
              v-model:activate="exportAllStarted"
              :callback="fetchGroup"
              :groupOrId="group"
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
