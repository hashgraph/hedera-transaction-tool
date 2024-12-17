<script setup lang="ts">
import type { IGroup } from '@renderer/services/organization';

import { computed, onBeforeMount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
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

import {
  getApiGroupById,
  getUserShouldApprove,
  sendApproverChoice,
  uploadSignatureMap,
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
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Stores */
const user = useUserStore();
const network = useNetwork();
const wsStore = useWebsocketConnection();
const nextTransaction = useNextTransactionStore();

/* Composables */
const router = useRouter();
const toast = useToast();
const ws = useDisposableWs();
useSetDynamicLayout(LOGGED_IN_LAYOUT);
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const group = ref<IGroup>();
const groupEmpty = computed(() => group.value?.groupItems.length == 0);
const shouldApprove = ref(false);
const isConfirmModalShown = ref(false);
const publicKeysRequiredToSign = ref<string[] | null>([]);
const disableSignAll = ref(false);
const isSigning = ref(false);
const isApproving = ref(false);

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

          const newKeys = await publicRequiredToSign(
            Transaction.fromBytes(transactionBytes),
            user.selectedOrganization.userKeys,
            network.mirrorNodeBaseURL,
          );

          publicKeysRequiredToSign.value = publicKeysRequiredToSign.value!.concat(newKeys);
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

  redirectToDetails(router, id, true);
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
    if (group.value != undefined) {
      for (const groupItem of group.value.groupItems) {
        const transactionBytes = hexToUint8Array(groupItem.transaction.transactionBytes);
        const transaction = Transaction.fromBytes(transactionBytes);
        const publicKeysRequired = await publicRequiredToSign(
          transaction,
          user.selectedOrganization.userKeys,
          network.mirrorNodeBaseURL,
        );
        await uploadSignatureMap(
          user.personal.id,
          personalPassword,
          user.selectedOrganization,
          publicKeysRequired,
          Transaction.fromBytes(transaction.toBytes()),
          groupItem.transaction.id,
        );
      }
    }
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
</script>
<template>
  <div class="p-5">
    <div class="d-flex align-items-center">
      <AppButton type="button" color="secondary" class="btn-icon-only me-4" @click="handleBack">
        <i class="bi bi-arrow-left"></i>
      </AppButton>

      <h2 class="text-title text-bold">Transaction Group Details</h2>
    </div>
    <div class="d-flex mt-4">
      <div class="form-group col-6">
        <label class="form-label">Transaction Group Description</label>
        <div>{{ group?.description }}</div>
      </div>
      <div v-if="isLoggedInOrganization(user.selectedOrganization)" class="form-group col-6">
        <label class="form-label">Sequential Execution</label>
        <div>{{ group?.sequential ? 'Yes' : 'No' }}</div>
      </div>
    </div>

    <hr class="separator my-5 w-100" />
    <div v-if="!groupEmpty">
      <table class="table-custom">
        <thead>
          <tr>
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
          <template v-for="(groupItem, index) in group?.groupItems" :key="groupItem.seq">
            <tr>
              <td data-testid="td-group-transaction-id">
                {{ groupItem.transaction.transactionId }}
              </td>
              <td>
                <span class="text-bold">{{ TransactionTypeName[groupItem.transaction.type] }}</span>
              </td>
              <td data-testid="td-group-valid-start-time">
                {{ getDateStringExtended(new Date(groupItem.transaction.validStart)) }}
              </td>
              <td class="text-center">
                <AppButton
                  type="button"
                  color="secondary"
                  @click.prevent="handleSign(groupItem.transaction.id)"
                  :data-testid="`button-group-transaction-${index}`"
                  >Details</AppButton
                >
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <div class="mt-5">
        <AppButton
          v-if="shouldApprove"
          color="secondary"
          type="button"
          class="me-3"
          :loading="isApproving"
          loading-text="Rejecting..."
          @click="handleApproveAll(false, true)"
        >
          Reject All
        </AppButton>
        <AppButton
          v-if="shouldApprove"
          color="primary"
          type="button"
          class="me-3"
          :loading="isApproving"
          loading-text="Approving..."
          @click="handleApproveAll(true, true)"
        >
          Approve All
        </AppButton>
        <AppButton
          v-if="
            isLoggedInOrganization(user.selectedOrganization) &&
            publicKeysRequiredToSign &&
            publicKeysRequiredToSign.length > 0 &&
            !disableSignAll
          "
          color="primary"
          type="button"
          :loading="isSigning"
          loading-text="Signing..."
          data-testid="button-sign-all-tx"
          @click="handleSignGroup"
        >
          Sign All
        </AppButton>
      </div>
    </div>
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
          <AppButton color="borderless" @click="isConfirmModalShown = false">Cancel</AppButton>
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
