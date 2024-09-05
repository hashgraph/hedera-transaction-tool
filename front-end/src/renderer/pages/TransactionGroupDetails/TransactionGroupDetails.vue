<script setup lang="ts">
import type { IGroup } from '@renderer/services/organization';
import type { USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import { computed, inject, onMounted, ref } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { useRouter } from 'vue-router';
import useUserStore from '@renderer/stores/storeUser';
import {
  isLoggedInOrganization,
  isLoggedInWithPassword,
  isUserLoggedIn,
} from '@renderer/utils/userStoreHelpers';
import { Transaction } from '@hashgraph/sdk';
import { useToast } from 'vue-toast-notification';
import useDisposableWs from '@renderer/composables/useDisposableWs';
import useNetwork from '@renderer/stores/storeNetwork';
import {
  fullUploadSignatures,
  getApiGroupById,
  getUserShouldApprove,
  sendApproverChoice,
} from '@renderer/services/organization';
import { publicRequiredToSign } from '@renderer/utils/transactionSignatureModels';
import { hexToUint8Array } from '@renderer/services/electronUtilsService';
import { USER_PASSWORD_MODAL_KEY } from '@renderer/providers';
import { TransactionStatus } from '@main/shared/interfaces';
import { decryptPrivateKey } from '@renderer/services/keyPairService';
import {
  getDateStringExtended,
  getPrivateKey,
  getTransactionBodySignatureWithoutNodeAccountId,
} from '@renderer/utils';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Stores */
const user = useUserStore();
const network = useNetwork();

/* Composables */
const router = useRouter();
const toast = useToast();
const ws = useDisposableWs();

/* State */
const group = ref<IGroup>();
const groupEmpty = computed(() => group.value?.groupItems.length == 0);
const shouldApprove = ref(false);
const isConfirmModalShown = ref(false);
const publicKeysRequiredToSign = ref<string[] | null>([]);
const disableSignAll = ref(false);

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

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

          const transactionBytes = await hexToUint8Array(item.transaction.transactionBytes);

          const newKeys = await publicRequiredToSign(
            Transaction.fromBytes(transactionBytes),
            user.selectedOrganization.userKeys,
            network.mirrorNodeBaseURL,
          );

          publicKeysRequiredToSign.value = publicKeysRequiredToSign.value!.concat(newKeys);
        }
      }
    } catch (error) {
      router.previousPath ? router.back() : router.push({ name: 'transactions' });
      throw error;
    }
  } else {
    console.log('not logged into org');
  }
}

/* Handlers */
const handleBack = () => {
  if (isLoggedInOrganization(user.selectedOrganization)) {
    const status = group.value?.groupItems[0].transaction.status;
    let tab: string = '';

    switch (status) {
      case TransactionStatus.EXECUTED:
      case TransactionStatus.FAILED:
      case TransactionStatus.EXPIRED:
        tab = 'History';
        break;
      case TransactionStatus.WAITING_FOR_EXECUTION:
        tab = 'Ready for Execution';
        break;
      case TransactionStatus.WAITING_FOR_SIGNATURES:
        tab = 'In Progress';
        break;
      default:
        tab = 'History';
        break;
    }

    router.push({
      name: 'transactions',
      query: {
        tab,
      },
    });
  } else {
    router.back();
  }
};

const handleSign = async (id: number) => {
  router.push({
    name: 'transactionDetails',
    params: { id },
    query: {
      sign: 'true',
    },
  });
};

const handleSignGroup = async () => {
  if (!isLoggedInOrganization(user.selectedOrganization) || !isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in organization');
  }

  if (!isLoggedInWithPassword(user.personal)) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    userPasswordModalRef.value?.open(
      'Enter your application password',
      'Enter your application password to decrypt your private key',
      handleSignGroup,
    );
    return;
  }

  try {
    if (group.value != undefined) {
      for (const groupItem of group.value.groupItems) {
        const transactionBytes = await hexToUint8Array(groupItem.transaction.transactionBytes);
        const transaction = Transaction.fromBytes(transactionBytes);
        const publicKeysRequired = await publicRequiredToSign(
          transaction,
          user.selectedOrganization.userKeys,
          network.mirrorNodeBaseURL,
        );
        await fullUploadSignatures(
          user.personal,
          user.selectedOrganization,
          publicKeysRequired,
          transaction,
          groupItem.transaction.id,
        );
      }
    }
    toast.success('Transactions signed successfully');
    disableSignAll.value = true;
  } catch {
    toast.error('Transactions not signed');
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

    if (group.value != undefined) {
      for (const item of group.value.groupItems) {
        if (await getUserShouldApprove(user.selectedOrganization.serverUrl, item.transaction.id)) {
          const transactionBytes = await hexToUint8Array(item.transaction.transactionBytes);
          const transaction = Transaction.fromBytes(transactionBytes);
          const signature = await getTransactionBodySignatureWithoutNodeAccountId(
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
          tab: 'History',
        },
      });
    }
  };

  await callback();
};

/* Hooks */
onMounted(async () => {
  const id = router.currentRoute.value.params.id;
  if (!id) {
    router.back();
    return;
  }

  ws.on('transaction_action', async () => {
    await handleFetchGroup(Array.isArray(id) ? id[0] : id);
  });

  await handleFetchGroup(Array.isArray(id) ? id[0] : id);
});
</script>
<template>
  <div class="p-5">
    <div class="d-flex align-items-center">
      <AppButton type="button" color="secondary" class="btn-icon-only me-4" @click="handleBack">
        <i class="bi bi-arrow-left"></i>
      </AppButton>

      <h2 class="text-title text-bold">Transaction Group Details</h2>
    </div>
    <div class="form-group col-6">
      <label class="form-label">Transaction Group Name</label>
      <div>{{ group?.description }}</div>
      <!-- <AppInput
          v-model="groupName"
          @update:modelValue="nameUpdated"
          filled
          placeholder="Enter Name"
        /> -->
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
          <template v-for="groupItem in group?.groupItems" :key="groupItem.seq">
            <tr>
              <td>
                {{ groupItem.transaction.transactionId }}
              </td>
              <td>
                <span class="text-bold">{{ groupItem.transaction.name }}</span>
              </td>
              <td>
                {{ getDateStringExtended(new Date(groupItem.transaction.validStart)) }}
              </td>
              <td class="text-center">
                <AppButton
                  type="button"
                  color="secondary"
                  @click.prevent="handleSign(groupItem.transaction.id)"
                  >Sign</AppButton
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
          @click="handleApproveAll(false, true)"
        >
          Reject All
        </AppButton>
        <AppButton
          v-if="shouldApprove"
          color="primary"
          type="button"
          class="me-3"
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
          @click="handleSignGroup"
        >
          Sign All
        </AppButton>
      </div>
    </div>
    <AppModal v-model:show="isConfirmModalShown" class="common-modal">
      <div class="modal-body">
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
