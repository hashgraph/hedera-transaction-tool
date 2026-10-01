<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { computed, onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/accountsService';

import {
  decorateAccountId,
  formatAccountId,
  getAccountIdWithChecksum,
  isUserLoggedIn,
  matchAccountId,
  sanitizeAccountId,
} from '@renderer/utils';

import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';
import { compareAccountIds } from '@renderer/utils/sortAccounts';

// Divider between the linked-accounts and owned-accounts groups in formattedAccountIds.
const ACCOUNT_LIST_SEPARATOR = '-';
function isAccountListSeparator(item: string): boolean {
  return item === ACCOUNT_LIST_SEPARATOR;
}

/* Props */
const props = defineProps<{
  modelValue: string;
  items?: string[];
  dataTestid?: string;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const accountIds = ref<HederaAccount[]>([]);

/* Computed */
const formattedAccountIds = computed(() => {
  let result: string[];
  if (props.items) {
    result = props.items;
  } else {
    const linkedAccounts = accountIds.value.map(a => a.account_id);
    const ownedAccounts = user.publicKeysToAccountsFlattened;
    linkedAccounts.sort(compareAccountIds);
    ownedAccounts.sort(compareAccountIds);
    if (linkedAccounts.length > 0 && ownedAccounts.length > 0) {
      result = linkedAccounts.concat([ACCOUNT_LIST_SEPARATOR]).concat(ownedAccounts);
    } else if (linkedAccounts.length > 0) {
      result = linkedAccounts;
    } else if (ownedAccounts.length > 0) {
      result = ownedAccounts;
    } else {
      result = [];
    }
  }
  return result.map(id => getAccountIdWithChecksum(id));
});

/* Handlers */
const handleUpdate = (value: string) => {
  const idWithoutChecksum = value.split('-')[0];
  emit('update:modelValue', idWithoutChecksum);
};

function handleOnBlur() {
  const idWithoutChecksum = props.modelValue.split('-')[0];
  emit('update:modelValue', formatAccountId(idWithoutChecksum));
}

/* Hooks */
onBeforeMount(async () => {
  if (isUserLoggedIn(user.personal)) {
    accountIds.value = await getAll({
      where: {
        user_id: user.personal.id,
        network: network.network,
      },
    });
  }
});
</script>
<template>
  <AppAutoComplete
    :model-value="modelValue"
    @update:model-value="handleUpdate"
    @blur="handleOnBlur"
    :items="formattedAccountIds"
    :sanitize="sanitizeAccountId"
    :find-match="matchAccountId"
    :decorate="decorateAccountId"
    :ignore-item="isAccountListSeparator"
    :data-testid="dataTestid"
    disable-spaces
    tabular-nums
    v-bind="$attrs"
  />
</template>
