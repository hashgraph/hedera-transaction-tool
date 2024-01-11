<script setup lang="ts">
import { ref } from 'vue';

import useUserStore from '../../../stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../composables/useAccountId';
import useCreateTooltips from '../../../composables/useCreateTooltips';

import { add } from '../../../services/accountsService';

import AppButton from '../../../components/ui/AppButton.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const toast = useToast();
useCreateTooltips();

/* State */
const accountData = useAccountId();
const nickname = ref('');

const handleLinkAccount = async () => {
  if (accountData.isValid.value) {
    try {
      if (!user.data.isLoggedIn) {
        throw new Error('User not logged in');
      }

      await add(user.data.email, accountData.accountIdFormatted.value, nickname.value);

      router.push({ name: 'accounts' });
      toast.success('Account linked successfully!', { position: 'top-right' });
    } catch (error: any) {
      toast.error(error.message || 'Account link failed', { position: 'top-right' });
    }
  }
};
</script>
<template>
  <div class="p-10">
    <AppButton
      color="primary"
      class="d-flex align-items-center justify-content-center"
      @click="$router.back()"
      ><i class="bi bi-arrow-left text-subheader me-2"></i> Back</AppButton
    >
    <div class="mt-5 col-12 col-md-8 col-xl-6 col-xxl-4">
      <div class="form-group">
        <label class="form-label">Set Hedera Account ID*</label>

        <label v-if="accountData.isValid.value" class="d-block form-label text-secondary"
          >Balance: {{ accountData.accountInfo.value?.balance || 0 }}</label
        >
        <input
          :value="accountData.accountIdFormatted.value"
          @input="accountData.accountId.value = ($event.target as HTMLInputElement).value"
          type="text"
          class="form-control"
          data-bs-toggle="tooltip"
          data-bs-placement="right"
          data-bs-custom-class="wide-tooltip"
          data-bs-title="The Hedera Account ID is the ID of the account entity on the Hedera network. This ID is used to specify the account in all Hedera transactions and queries."
          placeholder="0.0.4124"
        />
      </div>
      <div class="form-group mt-5">
        <label class="form-label">Set Nickname (optional)</label>
        <input v-model="nickname" class="form-control" />
      </div>
      <AppButton
        color="primary"
        class="mt-5 w-100"
        :disabled="!accountData.isValid.value"
        @click="handleLinkAccount"
        >Link Account</AppButton
      >
    </div>
  </div>
</template>
