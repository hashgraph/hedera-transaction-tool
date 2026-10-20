<script setup lang="ts">
import type { IAccountInfoParsed } from '@shared/interfaces';
import type { Key } from '@hiero-ledger/sdk';
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
// The key the user has explicitly chosen for the multi-account key field.
// undefined means "untouched" (no choice made yet); null is a real choice
// (e.g. deselecting a complex key, or clearing an invalid public key) and
// must not be treated the same as untouched.
const explicitKey = ref<Key | null | undefined>(undefined);

/* Computed */
// Expands the free-text "X.X.XXXX, X, X-X" input into the concrete list of
// account ids the transaction will target.
const selectedMultipleAccounts = computed(() =>
  splitMultipleAccounts(multipleAccountInput.value, network.client),
);

// A mirror-fetched key is only ever a default suggestion: it populates the
// field until the user explicitly chooses a key (including clearing it),
// and can never overwrite that choice afterwards (e.g. when the first
// account changes again). Browsing the Single/Complex tabs in KeyField
// without changing anything doesn't count as a choice — KeyField treats tabs
// as a pure view filter, so explicitKey is untouched by that alone.
const effectiveMultipleAccountsKey = computed(() =>
  explicitKey.value === undefined ? firstAccount.key.value : explicitKey.value,
);

// Single source of truth for the multi-account v-model exposed to the
// parent: null while in single-account mode (parent falls back to `data`),
// otherwise the live combination of the parsed account list, payer flag,
// and whichever key currently applies (mirrored or explicit).
const derivedMultipleAccountsData = computed<AccountUpdateDataMultiple | null>(() => {
  if (!multipleAccounts.value) return null;

  return {
    accountIds: selectedMultipleAccounts.value,
    accountIsPayer: accountIsPayer.value,
    key: effectiveMultipleAccountsKey.value,
  };
});

/* Handlers */
// Bubbles up from AccountDataFormData's `update:data`, which it only emits
// while multipleAccountsData is falsy (i.e. multipleAccounts.value is
// false) — so this is always the single-account field-change path.
const handleAccountDataUpdate = (data: AccountData) => {
  emit('update:data', {
    ...props.data,
    ...data,
  });
};

// The actual path a key change takes in multi-account mode: KeyField emits
// up through AccountDataFormData's handleUpdateKey, which (since
// multiple-accounts-data is set) emits `update:multiple-accounts-data`
// instead of `update:data`. Every call here is a genuine user choice — even
// `data.key === null` (KeyField only emits null for a real action: clearing
// an invalid public key, deselecting a complex key, or starting a "Create
// new" build — never from merely switching tabs) — so assigning it directly
// (out of its undefined default) is what lets effectiveMultipleAccountsKey
// stop mirroring the first account's key.
const handleMultipleAccountsDataUpdate = (data: AccountUpdateDataMultiple) => {
  explicitKey.value = data.key;
};

/* Watchers */
// Entering or leaving multi-account mode is a hard reset: clear the
// single-account id (and tell the parent so its mirrored accountInfo/key
// state resets too), the account list input, and any explicit key choice —
// otherwise leftover state from one mode would leak into the other.
watch(multipleAccounts, () => {
  emit('update:data', {
    ...props.data,
    accountId: '',
  });

  firstAccount.accountId.value = '';
  accountIsPayer.value = false;
  multipleAccountInput.value = '';
  explicitKey.value = undefined;
});

// `firstAccount` (a separate useAccountId composable) mirrors just the first
// id in the parsed list, purely so we can fetch its key as the default
// suggestion (effectiveMultipleAccountsKey) and show it in the key structure
// modal, without fetching account info for every selected account.
watch(selectedMultipleAccounts, accountIds => {
  firstAccount.accountId.value = accountIds[0]?.split('-')[0] || '';
});

// Pushes the locally-derived multi-account state up into the v-model so
// AccountUpdate.vue (and ultimately the transaction builder) sees it.
// immediate so the parent gets null right away on mount rather than waiting
// for a change.
watch(derivedMultipleAccountsData, data => (multipleAccountsData.value = data), {
  immediate: true,
});

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
    @update:multiple-accounts-data="handleMultipleAccountsDataUpdate"
  />

  <KeyStructureModal
    v-if="firstAccount.key.value || accountInfo"
    v-model:show="isKeyStructureModalShown"
    :account-key="firstAccount.key.value || accountInfo?.key"
  />
</template>
