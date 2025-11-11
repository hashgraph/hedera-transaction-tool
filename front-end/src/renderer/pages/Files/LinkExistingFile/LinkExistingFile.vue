<script setup lang="ts">
import { ref } from 'vue';
import { Prisma } from '@prisma/client';
import { FileId } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { add } from '@renderer/services/filesService';

import {
  isAccountId,
  isFileId,
  isUserLoggedIn,
  formatAccountId,
  getErrorMessage,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const router = useRouter();
const toast = useToast();
useCreateTooltips();

/* State */
const fileId = ref('');
const nickname = ref('');
const description = ref('');

const handleLinkFile = async () => {
  if (isAccountId(fileId.value)) {
    try {
      if (!isUserLoggedIn(user.personal)) {
        throw new Error('User is not logged in');
      }

      if (!isFileId(fileId.value)) {
        throw new Error('Invalid File ID');
      }

      const file: Prisma.HederaFileUncheckedCreateInput = {
        file_id: FileId.fromString(fileId.value).toString(),
        user_id: user.personal.id,
        nickname: nickname.value,
        description: description.value,
        network: network.network,
      };

      await add(file);

      toast.success('File linked successfully!', successToastOptions);
      await router.push({ name: 'files' });
    } catch (error) {
      toast.error(getErrorMessage(error, 'File link failed'));
    }
  }
};

function handleOnBlur() {
  fileId.value = formatAccountId(fileId.value);
}
</script>
<template>
  <div class="p-5">
    <AppButton
      color="primary"
      class="d-flex align-items-center justify-content-center"
      @click="$router.back()"
      ><i class="bi bi-arrow-left text-subheader me-2"></i> Back</AppButton
    >
    <form class="mt-5 col-12 col-md-8 col-lg-6 col-xxl-4" @submit.prevent="handleLinkFile">
      <div class="form-group">
        <label class="form-label">Hedera File ID <span class="text-danger">*</span></label>
        <AppInput
          :model-value="fileId"
          @update:model-value="fileId = $event"
          @blur="handleOnBlur"
          :filled="true"
          data-bs-toggle="tooltip"
          data-bs-placement="right"
          data-bs-custom-class="wide-tooltip"
          data-bs-title="The File ID of the file you would like to link on the Hedera network."
          data-testid="input-existing-file-id"
          placeholder="0.0.4124"
        />
      </div>
      <div class="form-group mt-5">
        <label class="form-label">Nickname</label>
        <AppInput v-model="nickname" :filled="true" placeholder="Enter nickname" />
      </div>
      <div class="form-group mt-5">
        <label class="form-label">Description</label>
        <textarea v-model="description" class="form-control is-fill" rows="8"></textarea>
      </div>
      <AppButton
        color="primary"
        data-testid="button-link-file"
        type="submit"
        class="mt-5"
        :disabled="!isFileId(fileId)"
        >Link File</AppButton
      >
    </form>
  </div>
</template>
