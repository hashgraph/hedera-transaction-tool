<script setup lang="ts">
import type { Key } from '@hashgraph/sdk';
import type { AccountData, AccountUpdateDataMultiple } from '@renderer/utils/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AccountIdInput from '@renderer/components/AccountIdInput.vue';
import KeyField from '@renderer/components/KeyField.vue';

/* Props */
const props = defineProps<{
  data: AccountData;
  multipleAccountsData?: AccountUpdateDataMultiple | null;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: AccountData): void;
  (event: 'update:multiple-accounts-data', data: AccountUpdateDataMultiple): void;
}>();

/* Stores */
const network = useNetworkStore();

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

const handleUpdateKey = (key: Key) => {
  if (!props.multipleAccountsData) {
    emit('update:data', {
      ...props.data,
      ownerKey: key,
    });
  } else {
    emit('update:multiple-accounts-data', {
      ...props.multipleAccountsData,
      key,
    });
  }
};

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="row mt-6">
    <div class="form-group col-8 col-xxxl-6">
      <KeyField
        :is-required="Boolean(multipleAccountsData)"
        :model-key="multipleAccountsData?.key || data.ownerKey"
        @update:model-key="handleUpdateKey($event)"
      />
    </div>
  </div>

  <template v-if="!multipleAccountsData">
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
          <AccountIdInput
            :model-value="data.stakedAccountId"
            @update:model-value="
              emit('update:data', {
                ...data,
                stakedAccountId: $event,
              })
            "
            :filled="true"
            placeholder="Enter Account ID"
            data-testid="input-stake-accountid"
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
          data-testid="input-max-auto-token-associations"
          :min="-1"
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
  </template>
</template>
