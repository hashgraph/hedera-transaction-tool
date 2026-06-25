<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { computed, onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useKeysStore from '@renderer/stores/storeKeys';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/accountsService';

import {
  formatAccountId,
  getAccountIdWithChecksum,
  isNodeCreationAuthorizedFeePayer,
  isUserLoggedIn,
} from '@renderer/utils';

import { ITEM_SEPARATOR } from '@renderer/components/ui/AppAutoComplete.vue';
import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';
import { compareAccountIds } from '@renderer/utils/sortAccounts';

/* Props */
const props = defineProps<{
  modelValue: string;
  items?: string[];
  dataTestid?: string;
  isNodeCreationPrivRequired?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const keys = useKeysStore();

/* State */
const accountIds = ref<HederaAccount[]>([]);

/* Computed */
const formattedAccountIds = computed(() => {
  let result: string[];
  if (props.items) {
    result = props.items;
  } else {
    const linkedAccounts = accountIds.value.map(a => a.account_id);
    const ownedAccounts = keys.publicKeysToAccountsFlattened;
    linkedAccounts.sort(compareAccountIds);
    ownedAccounts.sort(compareAccountIds);
    if (linkedAccounts.length > 0 && ownedAccounts.length > 0) {
      result = linkedAccounts.concat([ITEM_SEPARATOR]).concat(ownedAccounts);
    } else if (linkedAccounts.length > 0) {
      result = linkedAccounts;
    } else if (ownedAccounts.length > 0) {
      result = ownedAccounts;
    } else {
      result = [];
    }
  }
  if (props.isNodeCreationPrivRequired) {
    // We keep privileged accounts only
    result = result.filter(accountId => isNodeCreationAuthorizedFeePayer(accountId));
  }
  return result.map(id => getAccountIdWithChecksum(id));
});

const accountValue = computed(() => {
  const allIds = formattedAccountIds.value.map(id => id.split('-')[0]);
  return allIds.includes(props.modelValue)
    ? getAccountIdWithChecksum(props.modelValue)
    : props.modelValue;
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
    :model-value="accountValue"
    @update:model-value="handleUpdate"
    @blur="handleOnBlur"
    :items="formattedAccountIds"
    :data-testid="dataTestid"
    disable-spaces
    v-bind="$attrs"
  />
</template>
