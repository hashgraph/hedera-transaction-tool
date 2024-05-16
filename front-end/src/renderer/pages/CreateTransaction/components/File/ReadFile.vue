<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { FileContentsQuery, FileInfoQuery, Hbar, HbarUnit } from '@hashgraph/sdk';

import { HederaFile } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { decryptPrivateKey } from '@renderer/services/keyPairService';
import { executeQuery } from '@renderer/services/transactionService';
import { getAll, update } from '@renderer/services/filesService';

import { isHederaSpecialFileId } from '@renderer/utils/sdk';
import { isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AccountIdsSelect from '@renderer/components/AccountIdsSelect.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();
const route = useRoute();

/* State */
const maxQueryFee = ref<Hbar>(new Hbar(2));
const fileId = ref('');
const content = ref('');
const userPassword = ref('');
const isLoading = ref(false);
const isUserPasswordModalShown = ref(false);
const storedFiles = ref<HederaFile[]>([]);

/* Handlers */
const handleRead = async e => {
  e.preventDefault();

  if (!isUserLoggedIn(user.personal)) {
    throw Error('User is not logged in');
  }

  try {
    isLoading.value = true;

    const publicKey = user.publicKeyToAccounts.find(pa =>
      pa.accounts.some(acc => acc.account === payerData.accountIdFormatted.value),
    )?.publicKey;
    const keyPair = user.keyPairs.find(kp => kp.public_key === publicKey);

    if (!keyPair) {
      throw new Error('Unable to execute query, you should use a payer ID with one of your keys');
    }

    const privateKey = await decryptPrivateKey(
      user.personal.id,
      userPassword.value,
      keyPair.public_key,
    );

    const query = new FileContentsQuery()
      .setMaxQueryPayment(maxQueryFee.value as Hbar)
      .setFileId(fileId.value);

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

    toast.success('File content read', { position: 'bottom-right' });

    if (storedFiles.value.some(f => f.file_id === fileId.value)) {
      const fileInfoQuery = new FileInfoQuery()
        .setMaxQueryPayment(maxQueryFee.value as Hbar)
        .setFileId(fileId.value);

      const infoResponse = await executeQuery(
        fileInfoQuery.toBytes(),
        payerData.accountId.value,
        privateKey,
        keyPair.type,
      );

      await update(fileId.value, user.personal.id, {
        contentBytes: response.join(','),
        metaBytes: infoResponse.join(','),
        lastRefreshed: new Date(),
      });

      toast.success('Stored file info updated', { position: 'bottom-right' });
    }

    isUserPasswordModalShown.value = false;
  } catch (err: any) {
    let message = 'Failed to execute query';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'bottom-right' });
  } finally {
    network.client._operator = null;
    isLoading.value = false;
  }
};

const handleSubmit = e => {
  e.preventDefault();
  isUserPasswordModalShown.value = true;
};

/* Hooks */
onMounted(async () => {
  if (route.query.fileId) {
    fileId.value = route.query.fileId.toString();
  }

  if (!isUserLoggedIn(user.personal)) {
    throw Error('User is not logged in');
  }

  storedFiles.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
  });
});

/* Watchers */
watch(isUserPasswordModalShown, () => (userPassword.value = ''));

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleSubmit" class="flex-column-100">
      <TransactionHeaderControls heading-text="Read File Query">
        <template #buttons>
          <AppButton color="primary" type="submit" :disabled="!fileId || !payerData.isValid.value">
            <span class="bi bi-send"></span>
            Sign & Read</AppButton
          >
        </template>
      </TransactionHeaderControls>

      <hr class="separator my-5" />

      <div class="row align-items-end">
        <div class="form-group" :class="[columnClass]">
          <label class="form-label">Payer ID <span class="text-danger">*</span></label>
          <label v-if="payerData.isValid.value" class="d-block form-label text-secondary"
            >Balance: {{ payerData.accountInfo.value?.balance || 0 }}</label
          >
          <template v-if="!user.selectedOrganization">
            <AccountIdsSelect
              v-model:account-id="payerData.accountId.value"
              :select-default="true"
            />
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
        <div class="form-group" :class="[columnClass]">
          <label class="form-label">Max Query Fee {{ HbarUnit.Hbar._symbol }}</label>
          <AppHbarInput
            v-model:model-value="maxQueryFee as Hbar"
            :filled="true"
            placeholder="Enter Max Transaction Fee"
          />
        </div>
      </div>

      <hr class="separator my-5" />
      <div class="fill-remaining">
        <div class="row">
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
          <hr class="separator my-5" />

          <div class="d-grid">
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
