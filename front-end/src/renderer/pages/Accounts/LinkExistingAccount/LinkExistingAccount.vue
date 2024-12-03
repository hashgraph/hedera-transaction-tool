<script setup lang="ts">
import { ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import useSetDynamicLayout from '@renderer/composables/useSetDynamicLayout';

import { add } from '@renderer/services/accountsService';

import { isUserLoggedIn, formatAccountId, getErrorMessage } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const router = useRouter();
const toast = useToast();
useCreateTooltips();
useSetDynamicLayout({
  loggedInClass: true,
  shouldSetupAccountClass: false,
  showMenu: true,
});

/* State */
const accountData = useAccountId();
const nickname = ref('');

const handleLinkAccount = async (e: Event) => {
  e.preventDefault();

  if (accountData.isValid.value) {
    try {
      if (!isUserLoggedIn(user.personal)) {
        throw new Error('User not logged in');
      }

      await add(
        user.personal.id,
        accountData.accountIdFormatted.value,
        network.network,
        nickname.value,
      );

      router.push({ name: 'accounts' });
      toast.success('Account linked successfully!');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Account link failed'));
    }
  }
};
</script>
<template>
  <div class="p-5">
    <div class="d-flex align-items-center">
      <AppButton type="button" color="secondary" class="btn-icon-only me-4" @click="$router.back()">
        <i class="bi bi-arrow-left"></i>
      </AppButton>

      <h2 class="text-title text-bold">Link existing account</h2>
    </div>
    <form class="mt-5 col-12 col-md-8 col-lg-6 col-xxl-4" @submit="handleLinkAccount">
      <div class="form-group">
        <label class="form-label">Hedera Account ID <span class="text-danger">*</span></label>

        <label v-if="accountData.isValid.value" class="d-block form-label text-secondary"
          >Balance: {{ accountData.accountInfo.value?.balance || 0 }}</label
        >
        <AppInput
          :model-value="accountData.accountIdFormatted.value"
          @update:model-value="v => (accountData.accountId.value = formatAccountId(v))"
          :filled="true"
          data-testid="input-existing-account-id"
          data-bs-toggle="tooltip"
          data-bs-placement="right"
          data-bs-custom-class="wide-tooltip"
          data-bs-title="The Account ID of the account you would like to link on the Hedera network."
          placeholder="0.0.4124"
        />
      </div>
      <div class="form-group mt-5">
        <label class="form-label">Nickname</label>
        <AppInput v-model="nickname" :filled="true" placeholder="Enter nickname" />
      </div>
      <AppButton
        color="primary"
        data-testid="button-link-account-id"
        type="submit"
        class="mt-5"
        :disabled="!accountData.isValid.value"
        >Link Account</AppButton
      >
    </form>
  </div>
</template>
