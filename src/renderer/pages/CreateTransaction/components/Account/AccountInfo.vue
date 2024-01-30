<script setup lang="ts">
import { ref, watch } from 'vue';

import { useToast } from 'vue-toast-notification';
import useAccountId from '../../../../composables/useAccountId';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppInput from '../../../../components/ui/AppInput.vue';
import KeyStructureModal from '../../../../components/KeyStructureModal.vue';

/* Composables */
const toast = useToast();
const accountData = useAccountId();

/* State */
const isKeyStructureModalShown = ref(false);

/* Watchers */
watch(accountData.isValid, isValid => {
  if (isValid) {
    toast.clear();
  } else {
    toast.error('Account not found', { position: 'bottom-right' });
  }
});
</script>
<template>
  <div class="p-4 border rounded-4">
    <div class="d-flex justify-content-between">
      <div class="d-flex align-items-start">
        <i class="bi bi-arrow-up me-2"></i>
        <span class="text-title text-bold">Account Info</span>
      </div>
    </div>
    <div class="mt-4">
      <div class="mt-4 w-50 form-group">
        <label class="form-label">Set Account ID (Required)</label>
        <AppInput
          :model-value="accountData.accountIdFormatted.value"
          @update:model-value="v => (accountData.accountId.value = v)"
          :filled="true"
          placeholder="Enter Account ID"
        />
      </div>
      <template v-if="accountData.isValid.value">
        <p class="mt-4">
          <span class="text-secondary">EVM Address: </span>
          {{ accountData.accountInfo.value?.evmAddress }}
        </p>
        <hr class="my-3" />
        <div class="mt-4 d-flex row">
          <div class="col-6 d-flex flex-column gap-3">
            <div class="d-flex row">
              <p class="col-4 text-secondary">Balance:</p>
              <p class="col-8">{{ accountData.accountInfo.value?.balance }}</p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Staked to:</p>
              <p class="col-8">
                {{
                  accountData.accountInfo.value?.stakedNodeId
                    ? `Node ${accountData.accountInfo.value?.stakedNodeId}`
                    : accountData.accountInfo.value?.stakedAccountId
                }}
              </p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Pending Reward:</p>
              <p class="col-8">{{ accountData.accountInfo.value?.pendingRewards }}</p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Rewards:</p>
              <p class="col-8">
                {{ accountData.accountInfo.value?.declineReward ? 'Declined' : 'Accepted' }}
              </p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Memo:</p>
              <p class="col-8">{{ accountData.accountInfo.value?.memo }}</p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Created At:</p>
              <p class="col-8">
                {{
                  accountData.accountInfo.value?.createdTimestamp
                    ? new Date(
                        accountData.accountInfo.value?.createdTimestamp.seconds * 1000,
                      ).toDateString()
                    : 'None'
                }}
              </p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Expires At:</p>
              <p class="col-8">
                {{
                  accountData.accountInfo.value?.expiryTimestamp
                    ? new Date(
                        accountData.accountInfo.value?.expiryTimestamp.seconds * 1000,
                      ).toDateString()
                    : 'None'
                }}
              </p>
            </div>
            <div class="d-flex row" v-if="accountData.accountInfo.value?.autoRenewPeriod">
              <p class="col-4 text-secondary">Auto Renew Period:</p>
              <p class="col-8">{{ accountData.autoRenewPeriodInDays.value }} days</p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Max. Auto. Association:</p>
              <p class="col-8">
                {{ accountData.accountInfo.value?.maxAutomaticTokenAssociations }}
              </p>
            </div>
          </div>
          <div class="col-6">
            <div class="d-flex">
              <p class="text-secondary col-4">Admin Key:</p>
              <AppButton
                v-if="accountData.key.value"
                color="secondary"
                size="small"
                @click="isKeyStructureModalShown = true"
                >View Key Structure</AppButton
              >
            </div>
            <p class="mt-4"></p>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Receiver Sig. Required:</p>
              <p class="col-8">{{ accountData.accountInfo.value?.receiverSignatureRequired }}</p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Ethereum nonce:</p>
              <p class="col-8">{{ accountData.accountInfo.value?.ethereumNonce }}</p>
            </div>
          </div>
        </div>
      </template>
    </div>

    <KeyStructureModal
      v-if="accountData.isValid.value"
      v-model:show="isKeyStructureModalShown"
      :account-key="accountData.key.value"
    />
  </div>
</template>
