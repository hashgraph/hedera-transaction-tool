<script setup lang="ts">
import type { CryptoAllowance, IAccountInfoParsed } from '@main/shared/interfaces';
import type { ApproveHbarAllowanceData } from '@renderer/utils/sdk';

import { computed, ref, watch } from 'vue';
import { Hbar, HbarUnit, Key } from '@hashgraph/sdk';

import { stringifyHbar, formatAccountId, getAccountIdWithChecksum } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';

/* Props */
const props = defineProps<{
  ownerInfo: IAccountInfoParsed | null;
  ownerAllowances: CryptoAllowance[];
  spenderInfo: IAccountInfoParsed | null;
  data: ApproveHbarAllowanceData;
}>();

/* Emits */
defineEmits<{
  (event: 'update:data', data: ApproveHbarAllowanceData): void;
}>();

/* State */
const isKeyStructureModalShown = ref(false);
const keyStructureComponentKey = ref<Key | null>(null);
const ownerValue = ref('');
const spenderValue = ref('');
const isDataLoaded = ref(false);

/* Computed */
const spenderAllowance = computed(() => {
  return Hbar.fromTinybars(
    props.ownerAllowances.find(al => al.spender === props.spenderInfo?.accountId?.toString())
      ?.amount || 0,
  );
});

/* Handlers */
const handleBlur = (e: Event, accType: 'spender' | 'owner') => {
  const value = (e.target as HTMLInputElement).value;
  const formattedValue = getAccountIdWithChecksum(value);
  if (accType === 'owner') {
    if (formattedValue !== ownerValue.value) {
      ownerValue.value = formattedValue;
    }
  } else if (accType === 'spender') {
    if (formattedValue !== spenderValue.value) {
      spenderValue.value = formattedValue;
    }
  }
};

watch(
  () => [props.data.ownerAccountId, props.data.spenderAccountId],
  ([newOwner, newSpender]) => {
    if (!isDataLoaded.value && newOwner && newSpender) {
      ownerValue.value = getAccountIdWithChecksum(newOwner) || '';
      spenderValue.value = getAccountIdWithChecksum(newSpender) || '';
      isDataLoaded.value = true;
    }
  },
  { immediate: true },
);

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="row align-items-end">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Owner ID <span class="text-danger">*</span></label>
      <label class="form-label d-block text-secondary"
        >Balance: {{ ownerInfo ? stringifyHbar(ownerInfo.balance || new Hbar(0)) : '-' }}</label
      >

      <AppInput
        v-model="ownerValue"
        @update:model-value="
          $emit('update:data', {
            ...data,
            ownerAccountId: formatAccountId($event.split('-')[0]),
          })
        "
        :filled="true"
        data-testid="input-owner-account"
        placeholder="Enter Owner ID"
        @blur="handleBlur($event, 'owner')"
      />
    </div>

    <div class="form-group" :class="[columnClass]" v-if="ownerInfo?.key">
      <AppButton
        color="secondary"
        type="button"
        @click="
          isKeyStructureModalShown = true;
          keyStructureComponentKey = ownerInfo.key;
        "
        >Show Key</AppButton
      >
    </div>
  </div>

  <div class="row align-items-end mt-6">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Spender ID <span class="text-danger">*</span></label>
      <label v-if="spenderInfo" class="form-label d-block text-secondary"
        >Allowance: {{ stringifyHbar(spenderAllowance) }}</label
      >
      <AppInput
        v-model="spenderValue"
        @update:model-value="
          $emit('update:data', {
            ...data,
            spenderAccountId: formatAccountId($event.split('-')[0]),
          })
        "
        :filled="true"
        data-testid="input-spender-account"
        placeholder="Enter Spender ID"
        @blur="handleBlur($event, 'spender')"
      />
    </div>
    <div class="form-group" :class="[columnClass]" v-if="spenderInfo?.key">
      <AppButton
        color="secondary"
        type="button"
        @click="
          isKeyStructureModalShown = true;
          keyStructureComponentKey = spenderInfo?.key;
        "
        >Show Key</AppButton
      >
    </div>
  </div>

  <div class="row mt-6">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label"
        >Amount {{ HbarUnit.Hbar._symbol }} <span class="text-danger">*</span></label
      >
      <AppHbarInput
        :model-value="data.amount"
        @update:model-value="
          $emit('update:data', {
            ...data,
            amount: $event,
          })
        "
        data-testid="input-allowance-amount"
        placeholder="Enter Amount"
        :filled="true"
      />
    </div>
  </div>
</template>
