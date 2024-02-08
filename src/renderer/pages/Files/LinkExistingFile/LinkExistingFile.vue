<script setup lang="ts">
import { ref } from 'vue';

import { AccountId } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { add } from '@renderer/services/filesService';

import { isAccountId } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const toast = useToast();
useCreateTooltips();

/* State */
const fileId = ref('');
const nickname = ref('');

const handleLinkFile = async e => {
  e.preventDefault();

  if (isAccountId(fileId.value)) {
    try {
      if (!user.data.isLoggedIn) {
        throw new Error('User not logged in');
      }

      await add(user.data.id, AccountId.fromString(fileId.value).toString(), nickname.value);

      router.push({ name: 'files' });
      toast.success('File linked successfully!', { position: 'bottom-right' });
    } catch (error: any) {
      toast.error(error.message || 'File link failed', { position: 'bottom-right' });
    }
  }
};
</script>
<template>
  <div class="p-5">
    <AppButton
      color="primary"
      class="d-flex align-items-center justify-content-center"
      @click="$router.back()"
      ><i class="bi bi-arrow-left text-subheader me-2"></i> Back</AppButton
    >
    <form class="mt-5 col-12 col-md-8 col-xl-6 col-xxl-4" @submit="handleLinkFile">
      <div class="form-group">
        <label class="form-label">Hedera File ID <span class="text-danger">*</span></label>
        <AppInput
          v-model="fileId"
          :filled="true"
          data-bs-toggle="tooltip"
          data-bs-placement="right"
          data-bs-custom-class="wide-tooltip"
          data-bs-title="The File ID of the file you would like to link on the Hedera network."
          placeholder="0.0.4124"
        />
      </div>
      <div class="form-group mt-5">
        <label class="form-label">Nickname</label>
        <AppInput v-model="nickname" :filled="true" />
      </div>
      <AppButton color="primary" type="submit" class="mt-5 w-100" :disabled="!isAccountId(fileId)"
        >Link Account</AppButton
      >
    </form>
  </div>
</template>
