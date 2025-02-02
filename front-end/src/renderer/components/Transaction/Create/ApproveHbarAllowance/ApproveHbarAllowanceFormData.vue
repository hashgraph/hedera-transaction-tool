<script setup lang="ts">
import type { CryptoAllowance, IAccountInfoParsed } from '@main/shared/interfaces';
import type { ApproveHbarAllowanceData } from '@renderer/utils/sdk';

import { computed, ref } from 'vue';
import { Hbar, HbarUnit, Key } from '@hashgraph/sdk';

import { stringifyHbar, formatAccountId } from '@renderer/utils';

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
const value = ref(props.data.ownerAccountId);

/* Computed */
const spenderAllowance = computed(() => {
  return Hbar.fromTinybars(
    props.ownerAllowances.find(al => al.spender === props.spenderInfo?.accountId?.toString())
      ?.amount || 0,
  );
});

/* Handlers */
const handleBlur = () => {};

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
        :model-value="data.ownerAccountId"
        @update:model-value="
          $emit('update:data', {
            ...data,
            ownerAccountId: formatAccountId($event),
          })
        "
        :filled="true"
        data-testid="input-owner-account"
        placeholder="Enter Owner ID"
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
        :model-value="data.spenderAccountId"
        @update:model-value="
          $emit('update:data', {
            ...data,
            spenderAccountId: formatAccountId($event),
          })
        "
        :filled="true"
        data-testid="input-spender-account"
        placeholder="Enter Spender ID"
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
