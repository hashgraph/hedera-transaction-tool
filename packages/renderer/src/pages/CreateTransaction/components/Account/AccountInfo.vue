<script setup lang="ts">
import {ref, watch} from 'vue';

import {useToast} from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';

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
    toast.error('Account not found', {position: 'bottom-right'});
  }
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="d-flex justify-content-between align-items-center">
    <h2 class="text-title text-bold">Account Info</h2>
  </div>

  <AppButton
    type="button"
    color="secondary"
    class="mt-6"
    @click="$router.back()"
  >
    <span class="bi bi-arrow-left"></span>
    Back
  </AppButton>

  <div class="row mt-6">
    <div
      class="form-group"
      :class="[columnClass]"
    >
      <label class="form-label">Account ID <span class="text-danger">*</span></label>
      <AppInput
        :model-value="accountData.accountIdFormatted.value"
        :filled="true"
        placeholder="Enter Account ID"
        @update:model-value="v => (accountData.accountId.value = v)"
      />
    </div>
    <template v-if="accountData.isValid.value">
      <p class="mt-6">
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
                      accountData.accountInfo.value?.createdTimestamp.seconds
                        .multiply(1000)
                        .toNumber(),
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
                      accountData.accountInfo.value?.expiryTimestamp.seconds
                        .multiply(1000)
                        .toNumber(),
                    ).toDateString()
                  : 'None'
              }}
            </p>
          </div>
          <div
            v-if="accountData.accountInfo.value?.autoRenewPeriod"
            class="d-flex row"
          >
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
            >
              View Key Structure
            </AppButton>
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
</template>
