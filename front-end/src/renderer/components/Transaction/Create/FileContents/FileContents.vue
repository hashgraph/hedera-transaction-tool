<script setup lang="ts">
import type { HederaFile } from '@prisma/client';

import { onMounted, ref } from 'vue';
import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';
import { FileContentsQuery, FileInfoQuery, Hbar, HbarUnit } from '@hashgraph/sdk';

import { DISPLAY_FILE_SIZE_LIMIT } from '@shared/constants';
import { isHederaSpecialFileId } from '@shared/hederaSpecialFiles';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import useAccountId from '@renderer/composables/useAccountId';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { decryptPrivateKey } from '@renderer/services/keyPairService';
import { executeQuery } from '@renderer/services/transactionService';
import { add, getAll, update } from '@renderer/services/filesService';

import {
  assertUserLoggedIn,
  formatAccountId,
  encodeString,
  getErrorMessage,
} from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import AccountIdsSelect from '@renderer/components/AccountIdsSelect.vue';
import TransactionHeaderControls from '@renderer/components/Transaction/TransactionHeaderControls.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const payerData = useAccountId();
const route = useRoute();
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const maxQueryFee = ref<Hbar>(new Hbar(2));
const fileId = ref('');
const content = ref('');
const isLoading = ref(false);
const storedFiles = ref<HederaFile[]>([]);

/* Functions */
const readFile = async () => {
  assertUserLoggedIn(user.personal);
  const personalPassword = getPassword(readFile, {
    subHeading: 'Enter your application password to decrypt your keys and sign the transaction',
  });
  if (passwordModalOpened(personalPassword)) return;

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
      personalPassword,
      keyPair.public_key,
    );

    const response = await readContent(privateKey, keyPair.type);

    toast.success('File content read');

    const contentBytes = (
      isHederaSpecialFileId(fileId.value) ? encodeString(response) : response
    ).join(',');

    await updateLocalFileInfo(contentBytes, privateKey, keyPair.type);
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to execute query'));
  } finally {
    network.client._operator = null;
    isLoading.value = false;
  }
};

const readContent = async (privateKey: string, privateKeyType: string) => {
  const query = new FileContentsQuery()
    .setMaxQueryPayment(maxQueryFee.value as Hbar)
    .setFileId(fileId.value);

  const response = await executeQuery(
    query.toBytes(),
    payerData.accountId.value,
    privateKey,
    privateKeyType,
  );

  if (isHederaSpecialFileId(fileId.value)) {
    content.value = response;
  } else if (response.length <= DISPLAY_FILE_SIZE_LIMIT) {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(response);
    content.value = text;
  }

  return response;
};

const updateLocalFileInfo = async (content: string, privateKey: string, privateKeyType: string) => {
  assertUserLoggedIn(user.personal);

  try {
    const fileInfoQuery = new FileInfoQuery()
      .setMaxQueryPayment(maxQueryFee.value as Hbar)
      .setFileId(fileId.value);

    const infoResponse = await executeQuery(
      fileInfoQuery.toBytes(),
      payerData.accountId.value,
      privateKey,
      privateKeyType,
    );

    if (storedFiles.value.some(f => f.file_id === fileId.value)) {
      await update(fileId.value, user.personal.id, {
        contentBytes: content,
        metaBytes: infoResponse.join(','),
        lastRefreshed: new Date(),
      });

      toast.success('Stored file info updated');
    } else {
      await add({
        user_id: user.personal.id,
        file_id: fileId.value,
        network: network.network,
        contentBytes: content,
        metaBytes: infoResponse.join(','),
        lastRefreshed: new Date(),
      });

      toast.success(`File ${fileId.value} linked`);
    }
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to add/update file info'));
  }
};

const handleSubmit = async () => {
  await readFile();
};

/* Handlers */
function handleOnBlur() {
  fileId.value = formatAccountId(fileId.value);
}

/* Hooks */
onMounted(async () => {
  if (route.query.fileId) {
    fileId.value = route.query.fileId.toString();
  }

  assertUserLoggedIn(user.personal);

  storedFiles.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
  });
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="flex-column-100 overflow-hidden" v-focus-first-input>
    <form @submit.prevent="handleSubmit" class="flex-column-100">
      <TransactionHeaderControls
        heading-text="Read File Query"
        create-button-label="Sign & Read"
        :submit-manually="false"
        :reminder="null"
        :loading="isLoading"
        :valid-start="new Date()"
        :create-button-disabled="!fileId || !payerData.isValid.value || isLoading"
      >
      </TransactionHeaderControls>

      <hr class="separator my-5" />

      <div class="fill-remaining">
        <div class="row align-items-end">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">Payer ID <span class="text-danger">*</span></label>
            <label class="d-block form-label text-secondary"
              >Balance:
              {{ payerData.isValid.value ? payerData.accountInfo.value?.balance || 0 : '-' }}</label
            >
            <AccountIdsSelect
              v-model:account-id="payerData.accountId.value"
              :select-default="true"
            />
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

        <div class="row">
          <div class="form-group" :class="[columnClass]">
            <label class="form-label">File ID <span class="text-danger">*</span></label>
            <AppInput
              :model-value="fileId"
              @update:model-value="v => (fileId = v)"
              @blur="handleOnBlur"
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
  </div>
</template>
