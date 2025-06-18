<script setup lang="ts">
import type { IAccountInfoParsed } from 'lib';
import type { AccountDeleteData } from '@renderer/utils/sdk';

import { ref } from 'vue';
import { Key } from '@hashgraph/sdk';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AccountIdInput from '@renderer/components/AccountIdInput.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';

/* Props */
defineProps<{
  accountInfo: IAccountInfoParsed | null;
  transferAccountInfo: IAccountInfoParsed | null;
  data: AccountDeleteData;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: AccountDeleteData): void;
}>();

/* State */
const isKeyStructureModalShown = ref(false);
const keyStructureComponentKey = ref<Key | null>(null);

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="row align-items-end">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Account ID <span class="text-danger">*</span></label>
      <label class="d-block form-label text-secondary"
        >Balance: {{ accountInfo ? accountInfo.balance || 0 : '-' }}</label
      >
      <AccountIdInput
        :model-value="data.accountId"
        @update:model-value="
          emit('update:data', {
            ...data,
            accountId: $event,
          })
        "
        :filled="true"
        placeholder="Enter Account ID"
        data-testid="input-delete-account-id"
      />
    </div>

    <div class="form-group" :class="[columnClass]">
      <AppButton
        v-if="accountInfo?.key"
        class="text-nowrap"
        color="secondary"
        type="button"
        @click="
          isKeyStructureModalShown = true;
          keyStructureComponentKey = accountInfo.key;
        "
        >Show Key</AppButton
      >
    </div>
  </div>

  <div v-if="accountInfo" class="my-4">
    <p class="text-micro text-secondary">
      <span class="bi bi-info-circle-fill me-2"></span>
      In order to delete this account, you will need to transfer the remaining
      <span class="text-secondary">{{ accountInfo.balance || 0 }}</span>
      to another account
    </p>
  </div>

  <div class="my-4">
    <p v-if="accountInfo?.deleted" class="text-danger mt-4">Account is already deleted!</p>
  </div>

  <div class="row align-items-end mt-6">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Transfer Account ID <span class="text-danger">*</span></label>
      <label v-if="transferAccountInfo" class="d-block form-label text-secondary"
        >Receive Signature Required:
        {{ transferAccountInfo?.receiverSignatureRequired || false }}</label
      >
      <AccountIdInput
        :model-value="data.transferAccountId"
        @update:model-value="
          emit('update:data', {
            ...data,
            transferAccountId: $event,
          })
        "
        :filled="true"
        placeholder="Enter Account ID"
        data-testid="input-transfer-account-id"
      />
    </div>

    <div class="form-group" :class="[columnClass]">
      <AppButton
        v-if="transferAccountInfo?.key"
        color="secondary"
        type="button"
        @click="
          isKeyStructureModalShown = true;
          keyStructureComponentKey = transferAccountInfo.key;
        "
        >Show Key</AppButton
      >
    </div>
  </div>

  <div class="my-4">
    <p v-if="transferAccountInfo?.deleted" class="text-danger mt-4">Account is already deleted!</p>
  </div>

  <KeyStructureModal
    v-if="accountInfo || transferAccountInfo"
    v-model:show="isKeyStructureModalShown"
    :account-key="keyStructureComponentKey"
  />
</template>
