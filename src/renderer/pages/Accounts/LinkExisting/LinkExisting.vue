<script setup lang="ts">
import { ref } from 'vue';

import useUserStore from '../../../stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../composables/useAccountId';
import useCreateTooltips from '../../../composables/useCreateTooltips';

import { add } from '../../../services/accountsService';

import AppButton from '../../../components/ui/AppButton.vue';
import AppInput from '../../../components/ui/AppInput.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const toast = useToast();
useCreateTooltips();

/* State */
const accountData = useAccountId();
const nickname = ref('');

const handleLinkAccount = async e => {
  e.preventDefault();

  if (accountData.isValid.value) {
    try {
      if (!user.data.isLoggedIn) {
        throw new Error('User not logged in');
      }

      await add(user.data.id, accountData.accountIdFormatted.value, nickname.value);

      router.push({ name: 'accounts' });
      toast.success('Account linked successfully!', { position: 'bottom-right' });
    } catch (error: any) {
      toast.error(error.message || 'Account link failed', { position: 'bottom-right' });
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
    <form class="mt-5 col-12 col-md-8 col-xl-6 col-xxl-4" @submit="handleLinkAccount">
      <div class="form-group">
        <label class="form-label">Set Hedera Account ID*</label>

        <label v-if="accountData.isValid.value" class="d-block form-label text-secondary"
          >Balance: {{ accountData.accountInfo.value?.balance || 0 }}</label
        >
        <AppInput
          :model-value="accountData.accountIdFormatted.value"
          @update:model-value="v => (accountData.accountId.value = v)"
          :filled="true"
          data-bs-toggle="tooltip"
          data-bs-placement="right"
          data-bs-custom-class="wide-tooltip"
          data-bs-title="The Account ID of the account you would like to link on the Hedera network."
          placeholder="0.0.4124"
        />
      </div>
      <div class="form-group mt-5">
        <label class="form-label">Set Nickname (optional)</label>
        <AppInput v-model="nickname" :filled="true" />
      </div>
      <AppButton
        color="primary"
        type="submit"
        class="mt-5 w-100"
        :disabled="!accountData.isValid.value"
        >Link Account</AppButton
      >
    </form>
  </div>
</template>
