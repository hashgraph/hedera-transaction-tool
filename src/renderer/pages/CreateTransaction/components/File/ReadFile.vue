<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { FileContentsQuery, FileInfoQuery } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { decryptPrivateKey } from '@renderer/services/keyPairService';
import { executeQuery } from '@renderer/services/transactionService';

import { isHederaSpecialFileId } from '@main/shared/utils/hederaSpecialFiles';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AccountIdsSelect from '@renderer/components/AccountIdsSelect.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';
import { HederaFile } from '@prisma/client';
import { getAll, update } from '@renderer/services/filesService';

/* Stores */
const user = useUserStore();
const keyPairsStore = useKeyPairsStore();
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();
const route = useRoute();

/* State */
const fileId = ref('');
const content = ref('');
const userPassword = ref('');
const isLoading = ref(false);
const isUserPasswordModalShown = ref(false);
const storedFiles = ref<HederaFile[]>([]);

/* Handlers */
const handleRead = async e => {
  e.preventDefault();

  if (!user.data.isLoggedIn) {
    throw Error('User is not logged in');
  }

  try {
    isLoading.value = true;

    const publicKey = keyPairsStore.accoundIds.find(acc =>
      acc.accountIds.includes(payerData.accountIdFormatted.value),
    )?.publicKey;
    const keyPair = keyPairsStore.keyPairs.find(kp => kp.public_key === publicKey);

    if (!keyPair) {
      throw new Error('Unable to execute query, you should use a payer ID with one of your keys');
    }

    const privateKey = await decryptPrivateKey(
      user.data.id,
      userPassword.value,
      keyPair.public_key,
    );

    const query = new FileContentsQuery().setFileId(fileId.value);

    const response = await executeQuery(
      query.toBytes(),
      payerData.accountId.value,
      privateKey,
      keyPair.type,
    );

    if (isHederaSpecialFileId(fileId.value)) {
      content.value = response;
    } else {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(response);

      content.value = text;
    }

    const fileInfoQuery = new FileInfoQuery().setFileId(fileId.value);

    const infoResponse = await executeQuery(
      fileInfoQuery.toBytes(),
      payerData.accountId.value,
      privateKey,
      keyPair.type,
    );

    await updateIfStored(fileId.value, 'contentBytes', response);
    await updateIfStored(fileId.value, 'metaBytes', infoResponse);

    isUserPasswordModalShown.value = false;
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

  const allAccountIds = keyPairsStore.accoundIds.map(a => a.accountIds).flat();
  if (allAccountIds.length > 0) {
    payerData.accountId.value = allAccountIds[0];
  }

  if (route.query.fileId) {
    fileId.value = route.query.fileId.toString();
  }

  storedFiles.value = await getAll(user.data.id);
});

/* Watchers */
watch(isUserPasswordModalShown, () => (userPassword.value = ''));

/* Functions */
async function updateIfStored(
  fileId: string,
  property: 'contentBytes' | 'metaBytes',
  bytes: Uint8Array,
) {
  if (storedFiles.value.some(f => f.file_id === fileId)) {
    await update(fileId, user.data.id, { [property]: bytes.join(',') });
  }
}

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <form @submit="handleSubmit">
    <TransactionHeaderControls
      :create-requirements="!fileId || !payerData.isValid.value"
      heading-text="Read File Query"
      button-text="Sign and read"
    />

    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Payer ID <span class="text-danger">*</span></label>
        <label v-if="payerData.isValid.value" class="d-block form-label text-secondary"
          >Balance: {{ payerData.accountInfo.value?.balance || 0 }}</label
        >
        <template v-if="user.data.mode === 'personal'">
          <AccountIdsSelect v-model:account-id="payerData.accountId.value" :select-default="true" />
        </template>
        <template v-else>
          <AppInput
            :model-value="payerData.accountIdFormatted.value"
            @update:model-value="v => (payerData.accountId.value = v)"
            :filled="true"
            placeholder="Enter Payer ID"
          />
        </template>
      </div>
    </div>

    <div class="row mt-6">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">File ID <span class="text-danger">*</span></label>
        <AppInput v-model="fileId" :filled="true" placeholder="Enter File ID" />
      </div>
    </div>

    <div class="row mt-6">
      <div class="col-12 col-xl-8">
        <div class="d-flex justify-content-between">
          <label class="form-label">File Content</label>
          <label class="form-label ms-5" v-if="isHederaSpecialFileId(fileId)"
            >File content will be decoded, the actual content is protobuf encoded</label
          >
        </div>
        <textarea
          v-model="content"
          class="form-control text-code is-fill py-3"
          rows="10"
          readonly
        ></textarea>
      </div>
    </div>
  </form>

  <AppModal v-model:show="isUserPasswordModalShown" class="common-modal">
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="isUserPasswordModalShown = false"></i>
      </div>
      <div class="text-center">
        <AppCustomIcon :name="'lock'" style="height: 160px" />
      </div>
      <form @submit="handleRead">
        <h3 class="text-center text-title text-bold mt-3">Enter your password</h3>
        <div class="form-group mt-4">
          <AppInput v-model="userPassword" :filled="true" size="small" type="password" />
        </div>
        <div class="d-grid mt-4">
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
</template>
