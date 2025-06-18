<script setup lang="ts">
import type { Client } from '@hashgraph/sdk';
import type { IAccountInfoParsed } from 'lib';
import type {
  AccountData,
  AccountUpdateData,
  AccountUpdateDataMultiple,
} from '@renderer/utils/sdk';

import { computed, ref, watch } from 'vue';

import useNetworkStore from '@renderer/stores/storeNetwork';

import useAccountId from '@renderer/composables/useAccountId';

import { splitMultipleAccounts } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import AccountDataFormData from '@renderer/components/Transaction/Create/AccountData';
import AccountIdInput from '@renderer/components/AccountIdInput.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  accountInfo: IAccountInfoParsed | null;
  data: AccountUpdateData;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: AccountUpdateData): void;
}>();

/* Models */
const multipleAccountsData = defineModel<AccountUpdateDataMultiple | null>('multipleAccountsData', {
  required: true,
});

/* Stores */
const network = useNetworkStore();

/* Composables */
const firstAccount = useAccountId();

/* State */
const isKeyStructureModalShown = ref(false);
const multipleAccountInput = ref('');
const multipleAccounts = ref(false);
const accountIsPayer = ref(false);

/* Computed */
const selectedMultipleAccounts = computed(() =>
  splitMultipleAccounts(multipleAccountInput.value, network.client as Client),
);

/* Handlers */
const handleAccountDataUpdate = (data: AccountData) => {
  if (!multipleAccounts.value) {
    emit('update:data', {
      ...props.data,
      ...data,
    });
  } else if (multipleAccountsData.value) {
    multipleAccountsData.value = {
      ...multipleAccountsData.value,
      key: data.ownerKey,
    };
  }
};

/* Watchers */
watch(multipleAccounts, multiple => {
  emit('update:data', {
    ...props.data,
    accountId: '',
  });

  firstAccount.accountId.value = '';
  accountIsPayer.value = false;
  multipleAccountInput.value = '';

  if (!multiple) {
    multipleAccountsData.value = null;
  } else {
    multipleAccountsData.value = {
      accountIds: [],
      accountIsPayer: false,
      key: null,
    };
  }
});

watch([selectedMultipleAccounts, accountIsPayer], ([accountIds, isPayer]) => {
  multipleAccountsData.value = {
    accountIds,
    accountIsPayer: isPayer,
    key: multipleAccountsData.value?.key || null,
  };

  firstAccount.accountId.value = accountIds[0]?.split('-')[0] || '';
});

watch(
  () => firstAccount.accountInfo.value,
  info => {
    if (info?.key && multipleAccountsData.value) {
      multipleAccountsData.value = {
        ...multipleAccountsData.value,
        key: info.key,
      };
    }
  },
);

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="row">
    <div class="form-group" :class="[columnClass]">
      <div class="d-flex align-items-center gap-3">
        <label class="form-label text-nowrap">Account ID <span class="text-danger">*</span></label>
        <div class="mb-2">
          <AppCheckBox
            v-model:checked="multipleAccounts"
            label="Multiple accounts"
            name="multiple-accounts"
            class="text-nowrap"
          />
        </div>
        <template v-if="multipleAccounts">
          <div class="mb-2">
            <AppCheckBox
              v-model:checked="accountIsPayer"
              label="Account is Payer"
              name="account-is-payer"
              class="text-nowrap"
            />
          </div>
        </template>
      </div>
      <template v-if="!multipleAccounts">
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
          data-testid="input-account-id-for-update"
        />
      </template>
      <div v-if="accountInfo" data-testid="div-account-info-fetched"></div>

      <template v-if="multipleAccounts">
        <AppInput v-model="multipleAccountInput" :filled="true" placeholder="X.X.XXXX, X, X-X" />
      </template>
    </div>

    <div class="form-group mt-6" :class="[columnClass]">
      <AppButton
        v-if="firstAccount.key.value || accountInfo?.key"
        class="text-nowrap"
        color="secondary"
        type="button"
        @click="isKeyStructureModalShown = true"
        >Show Key</AppButton
      >
    </div>
  </div>

  <template v-if="multipleAccounts">
    <div class="row mt-6">
      <div class="form-group col-8 col-xxxl-6">
        <div class="border rounded p-4">
          <div class="overflow-auto" :style="{ height: '30vh', maxHeight: '30vh' }">
            <template v-for="account of selectedMultipleAccounts" :key="account">
              <div>{{ account }}</div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </template>
  <AccountDataFormData
    :data="data"
    :multiple-accounts-data="multipleAccountsData"
    @update:data="handleAccountDataUpdate"
    @update:multiple-accounts-data="multipleAccountsData = $event"
  />

  <KeyStructureModal
    v-if="firstAccount.key.value || accountInfo"
    v-model:show="isKeyStructureModalShown"
    :account-key="firstAccount.key.value || accountInfo?.key"
  />
</template>
