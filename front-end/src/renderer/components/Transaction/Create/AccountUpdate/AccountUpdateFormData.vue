<script setup lang="ts">
import type { IAccountInfoParsed } from '@main/shared/interfaces';
import type { AccountUpdateData } from '@renderer/utils/sdk/createTransactions';

import { ref } from 'vue';
import { Key } from '@hashgraph/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { formatAccountId } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import KeyField from '@renderer/components/KeyField.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';

/* Props */
const props = defineProps<{
  accountInfo: IAccountInfoParsed | null;
  data: AccountUpdateData;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: AccountUpdateData): void;
}>();

/* Stores */
const network = useNetworkStore();

/* State */
const isKeyStructureModalShown = ref(false);

/* Handlers */
const handleStakeTypeChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  const value = selectEl.value;

  if (value === 'None') {
    emit('update:data', {
      ...props.data,
      stakeType: 'None',
      stakedNodeId: null,
      stakedAccountId: '',
    });
  } else if (value === 'Account' || value === 'Node') {
    emit('update:data', {
      ...props.data,
      stakeType: value,
    });
  }
};

const handleNodeNumberChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  const value = selectEl.value;

  if (value === 'unselected') {
    emit('update:data', {
      ...props.data,
      stakedNodeId: null,
    });
  } else if (!isNaN(Number(value))) {
    emit('update:data', {
      ...props.data,
      stakedNodeId: Number(value),
    });
  }
};

const handleOwnerKeyUpdate = (key: Key) => {
  emit('update:data', {
    ...props.data,
    ownerKey: key,
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

  <div class="row mt-6">
    <div class="form-group col-8 col-xxxl-6">
      <KeyField :model-key="data.ownerKey" @update:model-key="handleOwnerKeyUpdate" />
    </div>
  </div>

  <div class="form-group mt-6">
    <AppSwitch
      :checked="!data.declineStakingReward"
      @update:checked="
        emit('update:data', {
          ...data,
          declineStakingReward: !$event,
        })
      "
      size="md"
      name="accept-staking-rewards"
      label="Accept Staking Rewards"
      data-testid="switch-accept-staking-rewards"
    />
  </div>

  <div class="row mt-6">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Staking</label>
      <select
        class="form-select is-fill"
        data-testid="dropdown-staking-account"
        name="stake_type"
        @change="handleStakeTypeChange"
      >
        <template v-for="stakeEntity in ['None', 'Account', 'Node']" :key="stakeEntity">
          <option
            :value="stakeEntity"
            :selected="data.stakeType === stakeEntity"
            :data-testid="'option-' + stakeEntity.toLowerCase()"
          >
            {{ stakeEntity }}
          </option>
        </template>
      </select>
    </div>
    <div v-if="data.stakeType !== 'None'" class="form-group" :class="[columnClass]">
      <template v-if="data.stakeType === 'Account'">
        <label class="form-label">Account ID <span class="text-danger">*</span></label>
        <AppInput
          data-testid="input-stake-accountid"
          :model-value="data.stakedAccountId"
          @update:model-value="
            emit('update:data', {
              ...data,
              stakedAccountId: formatAccountId($event),
            })
          "
          :filled="true"
          placeholder="Enter Account ID"
        />
      </template>
      <template v-else-if="data.stakeType === 'Node'">
        <label class="form-label">Node Number <span class="text-danger">*</span></label>
        <select class="form-select is-fill" name="node_number" @change="handleNodeNumberChange">
          <option
            value="unselected"
            :selected="data.stakedNodeId === null"
            default
            data-testid="option-no-node-selected"
          >
            No node selected
          </option>
          <template v-for="nodeNumber in network.nodeNumbers" :key="nodeNumber">
            <option
              :value="nodeNumber"
              :selected="data.stakedNodeId === nodeNumber"
              :data-testid="'option-node-' + nodeNumber"
            >
              {{ nodeNumber }}
            </option>
          </template>
        </select>
      </template>
    </div>
  </div>

  <div class="mt-6">
    <AppSwitch
      :checked="data.receiverSignatureRequired"
      @update:checked="
        emit('update:data', {
          ...data,
          receiverSignatureRequired: $event,
        })
      "
      data-testid="switch-receiver-sig-required"
      size="md"
      name="receiver-signature"
      label="Receiver Signature Required"
    />
  </div>

  <div class="row mt-6">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Max Automatic Token Associations</label>
      <AppInput
        :model-value="data.maxAutomaticTokenAssociations"
        @update:model-value="
          emit('update:data', {
            ...data,
            maxAutomaticTokenAssociations: Number($event),
          })
        "
        data-testid="input-max-auto-associations"
        :min="0"
        :max="5000"
        :filled="true"
        type="number"
        placeholder="Enter Max Token Auto Associations"
      />
    </div>
  </div>

  <div class="row mt-6">
    <div class="form-group col-8 col-xxxl-6">
      <label class="form-label">Account Memo</label>
      <AppInput
        data-testid="input-account-memo"
        :model-value="data.accountMemo"
        @update:model-value="
          emit('update:data', {
            ...data,
            accountMemo: $event,
          })
        "
        :filled="true"
        maxlength="100"
        placeholder="Enter Account Memo"
      />
    </div>
  </div>

  <KeyStructureModal
    v-if="accountInfo"
    v-model:show="isKeyStructureModalShown"
    :account-key="accountInfo.key"
  />
</template>
