<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { FileContentsQuery } from '@hashgraph/sdk';

import useUserStore from '../../../../stores/storeUser';
import useKeyPairsStore from '../../../../stores/storeKeyPairs';
import useNetworkStore from '../../../../stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import { decryptPrivateKey } from '../../../../services/keyPairService';
import { executeQuery } from '../../../../services/transactionService';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';

/* Stores */
const user = useUserStore();
const keyPairsStore = useKeyPairsStore();
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();

/* State */
const fileId = ref('');
const content = ref('');
const userPassword = ref('');
const isLoading = ref(false);
const isUserPasswordModalShown = ref(false);

/* Handlers */
const handleRead = async e => {
  e.preventDefault();

  if (!user.data.isLoggedIn) {
    throw Error('User is not logged in');
  }

  try {
    isLoading.value = true;

    const publicKey = keyPairsStore.accoundIds.find(acc =>
      acc.accountIds.includes(payerData.accountId.value),
    )?.publicKey;

    const privateKey = await decryptPrivateKey(user.data.id, userPassword.value, publicKey || '');

    const query = new FileContentsQuery().setFileId(fileId.value);

    // Send to Transaction w/ user signatures to Back End
    const { response } = await executeQuery(
      query.toBytes().toString(),
      networkStore.network,
      networkStore.customNetworkSettings,
      payerData.accountId.value,
      privateKey,
    );
    isUserPasswordModalShown.value = false;

    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(response);

    content.value = text;
  } catch (err: any) {
    let message = 'Failed to execute query';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'bottom-right' });
  } finally {
    networkStore.client._operator = null;
    isLoading.value = false;
  }
};

const handleSubmit = e => {
  e.preventDefault();
  isUserPasswordModalShown.value = true;
};
/* Hooks */
onMounted(async () => {
  await keyPairsStore.refetch();
});

/* Watchers */
watch(isUserPasswordModalShown, () => (userPassword.value = ''));
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-small text-bold">Read File Query</span>
      </div>
    </div>
    <form class="mt-4" @submit="handleSubmit">
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set Payer ID</label>
        <label v-if="payerData.isValid.value" class="d-block form-label text-secondary"
          >Balance: {{ payerData.accountInfo.value?.balance || 0 }}</label
        >
        <select
          :value="payerData.accountIdFormatted.value"
          @input="payerData.accountId.value = ($event.target as HTMLInputElement).value"
          class="form-select py-3"
          placeholder="Enter Payer ID"
        >
          <option value="">Select Payer ID</option>
          <option
            v-for="(kp, i) in keyPairsStore.accoundIds.map(account => account.accountIds).flat()"
            :key="i"
            :value="kp"
          >
            {{ kp }}
          </option>
        </select>
      </div>
      <div class="mt-4 form-group w-50">
        <label class="form-label">Set File ID</label>
        <input
          v-model="fileId"
          type="text"
          class="form-control is-fill py-3"
          placeholder="Enter owner public key"
        />
      </div>
      <div class="mt-4 form-group w-75">
        <label class="form-label">File Content</label>
        <textarea v-model="content" class="form-control is-fill py-3" rows="10" readonly></textarea>
      </div>
      <div class="mt-4">
        <AppButton
          size="large"
          type="submit"
          color="primary"
          :disabled="!fileId || !payerData.isValid.value"
          >Read</AppButton
        >
      </div>
    </form>
    <AppModal v-model:show="isUserPasswordModalShown" class="common-modal">
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isUserPasswordModalShown = false"></i>
        </div>
        <div class="text-center mt-5">
          <i class="bi bi-shield-lock large-icon"></i>
        </div>
        <form @submit="handleRead">
          <h3 class="text-center text-title text-bold mt-5">Enter your password</h3>
          <div class="form-group mt-4">
            <input
              v-model="userPassword"
              type="password"
              class="form-control form-control-sm is-fill"
            />
          </div>
          <div class="d-grid mt-5">
            <AppButton
              :loading="isLoading"
              :disabled="userPassword.length === 0 || isLoading"
              color="primary"
              type="submit"
              >Sign Query</AppButton
            >
          </div>
        </form>
      </div>
    </AppModal>
  </div>
</template>
