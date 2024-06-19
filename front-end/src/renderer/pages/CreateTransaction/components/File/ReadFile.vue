<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { FileContentsQuery, FileId, FileInfoQuery, Hbar, HbarUnit } from '@hashgraph/sdk';

import { HederaFile } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { decryptPrivateKey } from '@renderer/services/keyPairService';
import { executeQuery } from '@renderer/services/transactionService';
import { add, getAll, update } from '@renderer/services/filesService';

import { isFileId, isHederaSpecialFileId, formatAccountId, encodeString } from '@renderer/utils';
import { isUserLoggedIn, flattenAccountIds } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AccountIdsSelect from '@renderer/components/AccountIdsSelect.vue';
import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';
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

/* Computed */
const accoundIds = computed<string[]>(() => flattenAccountIds(user.publicKeyToAccounts));

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

    try {
      const fileInfoQuery = new FileInfoQuery()
        .setMaxQueryPayment(maxQueryFee.value as Hbar)
        .setFileId(fileId.value);

      const infoResponse = await executeQuery(
        fileInfoQuery.toBytes(),
        payerData.accountId.value,
        privateKey,
        keyPair.type,
      );

      const contentBytes = (
        isHederaSpecialFileId(fileId.value) ? encodeString(response) : response
      ).join(',');

      if (storedFiles.value.some(f => f.file_id === fileId.value)) {
        await update(fileId.value, user.personal.id, {
          contentBytes,
          metaBytes: infoResponse.join(','),
          lastRefreshed: new Date(),
        });

        toast.success('Stored file info updated', { position: 'bottom-right' });
      } else {
        await add({
          user_id: user.personal.id,
          file_id: fileId.value,
          network: network.network,
          contentBytes,
          metaBytes: infoResponse.join(','),
          lastRefreshed: new Date(),
        });

        toast.success(`File ${fileId.value} linked`, { position: 'bottom-right' });
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add/update file info', { position: 'bottom-right' });
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
watch(fileId, id => {
  if (isFileId(id) && id !== '0') {
    fileId.value = FileId.fromString(id).toString();
  }
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="flex-column-100 overflow-hidden">
    <form @submit="handleSubmit" class="flex-column-100">
      <TransactionHeaderControls heading-text="Read File Query">
        <template #buttons>
          <AppButton color="primary" type="submit" :disabled="!fileId || !payerData.isValid.value">
            <span class="bi bi-send" data-testid="button-sign-and-read-file"></span>
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
            <AppAutoComplete
              :model-value="payerData.isValid.value ? payerData.accountIdFormatted.value : ''"
              @update:model-value="payerData.accountId.value = formatAccountId($event)"
              :filled="true"
              :items="accoundIds"
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
            <AppInput
              :model-value="fileId"
              @update:model-value="v => (fileId = formatAccountId(v))"
              :filled="true"
              placeholder="Enter File ID"
              data-testid="input-file-id-for-read"
            />
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
              data-testid="text-area-read-file-content"
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
            <AppInput
              v-model="userPassword"
              :filled="true"
              data-testid="input-password-for-sign-query"
              size="small"
              type="password"
            />
          </div>
          <hr class="separator my-5" />

          <div class="d-grid">
            <AppButton
              :loading="isLoading"
              :disabled="userPassword.length === 0 || isLoading"
              color="primary"
              type="submit"
              data-testid="button-sign-read-query"
              >Sign Query</AppButton
            >
          </div>
        </form>
      </div>
    </AppModal>
  </div>
</template>
