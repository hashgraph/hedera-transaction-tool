<script setup lang="ts">
import { ref, watch } from 'vue';

import { AccountId, KeyList, PublicKey } from '@hashgraph/sdk';

import { MirrorNodeAccountInfo } from '../../../../interfaces/MirrorNodeAccountInfo';

import { getAccountInfo } from '../../../../services/mirrorNodeDataService';

import useNetworkStore from '../../../../stores/storeNetwork';

import AppButton from '../../../../components/ui/AppButton.vue';
import AppModal from '../../../../components/ui/AppModal.vue';
import KeyStructure from '../../../../components/KeyStructure.vue';

const network = useNetworkStore();

/* State */
const isKeyStructureModalShown = ref(false);

const accountId = ref('');
const accountData = ref<MirrorNodeAccountInfo | null>(null);

/* Watchers */
watch(accountId, async newAccountId => {
  if (!newAccountId) return;

  try {
    accountId.value = AccountId.fromString(newAccountId).toString();

    accountData.value = await getAccountInfo(newAccountId, network.mirrorNodeBaseURL);
  } catch (e) {
    accountData.value = null;
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
        <input
          v-model="accountId"
          type="text"
          class="form-control"
          placeholder="Enter Account ID"
        />
      </div>
      <template v-if="accountData">
        <p class="mt-4">
          <span class="text-secondary">EVM Address: </span>
          {{ accountData.evmAddress }}
        </p>
        <hr class="my-3" />
        <div class="mt-4 d-flex row">
          <div class="col-6 d-flex flex-column gap-3">
            <div class="d-flex row">
              <p class="col-4 text-secondary">Balance:</p>
              <p class="col-8">{{ accountData.balance }}</p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Staked to:</p>
              <p class="col-8">
                {{
                  accountData.stakedNodeId
                    ? `Node ${accountData.stakedNodeId}`
                    : accountData.stakedAccountId
                }}
              </p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Pending Reward:</p>
              <p class="col-8">{{ accountData.pendingRewards }}</p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Rewards:</p>
              <p class="col-8">{{ accountData.declineReward ? 'Declined' : 'Accepted' }}</p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Memo:</p>
              <p class="col-8">{{ accountData.memo }}</p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Created At:</p>
              <p class="col-8">
                {{ new Date(accountData.createdTimestamp.seconds * 1000).toDateString() }}
              </p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Expires At:</p>
              <p class="col-8">
                {{ new Date(accountData.expiryTimestamp.seconds * 1000).toDateString() }}
              </p>
            </div>
            <div class="d-flex row" v-if="accountData.autoRenewPeriod">
              <p class="col-4 text-secondary">Auto Renew Period:</p>
              <p class="col-8">{{ (accountData.autoRenewPeriod / 86400).toFixed(0) }} days</p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Max. Auto. Association:</p>
              <p class="col-8">{{ accountData.maxAutomaticTokenAssociations }}</p>
            </div>
          </div>
          <div class="col-6">
            <div class="d-flex">
              <p class="text-secondary col-4">Admin Key:</p>
              <AppButton
                v-if="accountData.key"
                color="secondary"
                size="small"
                @click="isKeyStructureModalShown = true"
                >View Key Structure</AppButton
              >
            </div>
            <p class="mt-4"></p>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Receiver Sig. Required:</p>
              <p class="col-8">{{ accountData.receiverSignatureRequired }}</p>
            </div>
            <div class="d-flex row">
              <p class="col-4 text-secondary">Ethereum nonce:</p>
              <p class="col-8">{{ accountData.ethereumNonce }}</p>
            </div>
          </div>
        </div>
      </template>
    </div>
    <AppModal
      v-model:show="isKeyStructureModalShown"
      v-if="accountData?.key"
      class="modal-fit-content"
    >
      <div class="p-5">
        <KeyStructure
          v-if="accountData.key instanceof KeyList && true"
          :key-list="accountData.key"
        />
        <div v-else-if="accountData.key instanceof PublicKey && true">
          {{ accountData.key.toStringRaw() }}
        </div>
      </div>
    </AppModal>
  </div>
</template>
