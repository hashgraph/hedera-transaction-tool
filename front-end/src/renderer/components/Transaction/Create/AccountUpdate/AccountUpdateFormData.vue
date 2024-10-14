<script setup lang="ts">
import type { IAccountInfoParsed } from '@main/shared/interfaces';
import type { AccountData, AccountUpdateData } from '@renderer/utils/sdk';

import { ref } from 'vue';

import { formatAccountId } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import AccountDataFormData from '@renderer/components/Transaction/Create/AccountData';

/* Props */
const props = defineProps<{
  accountInfo: IAccountInfoParsed | null;
  data: AccountUpdateData;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: AccountUpdateData): void;
}>();

/* State */
const isKeyStructureModalShown = ref(false);

/* Handlers */
const handleAccountDataUpdate = (data: AccountData) => {
  emit('update:data', {
    ...props.data,
    ...data,
  });
};

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="row">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Account ID <span class="text-danger">*</span></label>
      <AppInput
        :model-value="formatAccountId(data.accountId)"
        @update:model-value="
          emit('update:data', {
            ...data,
            accountId: formatAccountId($event),
          })
        "
        :filled="true"
        data-testid="input-account-id-for-update"
        placeholder="Enter Account ID"
      />
      <div v-if="accountInfo" data-testid="div-account-info-fetched"></div>
    </div>

    <div class="form-group mt-6" :class="[columnClass]">
      <AppButton
        v-if="accountInfo?.key"
        class="text-nowrap"
        color="secondary"
        type="button"
        @click="isKeyStructureModalShown = true"
        >Show Key</AppButton
      >
    </div>
  </div>

  <AccountDataFormData :data="data" @update:data="handleAccountDataUpdate" />

  <KeyStructureModal
    v-if="accountInfo"
    v-model:show="isKeyStructureModalShown"
    :account-key="accountInfo.key"
  />
</template>
