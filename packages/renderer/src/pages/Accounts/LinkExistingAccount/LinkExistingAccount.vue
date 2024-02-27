<script setup lang="ts">
import {ref} from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import {useRouter} from 'vue-router';
import {useToast} from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import {add} from '@renderer/services/accountsService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

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

      router.push({name: 'accounts'});
      toast.success('Account linked successfully!', {position: 'bottom-right'});
    } catch (error: any) {
      toast.error(error.message || 'Account link failed', {position: 'bottom-right'});
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
    >
      <i class="bi bi-arrow-left text-subheader me-2"></i> Back
    </AppButton>
    <form
      class="mt-5 col-12 col-md-8 col-xl-6 col-xxl-4"
      @submit="handleLinkAccount"
    >
      <div class="form-group">
        <label class="form-label">Hedera Account ID <span class="text-danger">*</span></label>

        <label
          v-if="accountData.isValid.value"
          class="d-block form-label text-secondary"
          >Balance: {{ accountData.accountInfo.value?.balance || 0 }}</label
        >
        <AppInput
          :model-value="accountData.accountIdFormatted.value"
          :filled="true"
          data-bs-toggle="tooltip"
          data-bs-placement="right"
          data-bs-custom-class="wide-tooltip"
          data-bs-title="The Account ID of the account you would like to link on the Hedera network."
          placeholder="0.0.4124"
          @update:model-value="v => (accountData.accountId.value = v)"
        />
      </div>
      <div class="form-group mt-5">
        <label class="form-label">Nickname</label>
        <AppInput
          v-model="nickname"
          :filled="true"
        />
      </div>
      <AppButton
        color="primary"
        type="submit"
        class="mt-5 w-100"
        :disabled="!accountData.isValid.value"
      >
        Link Account
      </AppButton>
    </form>
  </div>
</template>
