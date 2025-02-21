<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { computed, onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/accountsService';

import { formatAccountId, getAccountIdWithChecksum, isUserLoggedIn } from '@renderer/utils';

import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';

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
const accoundIds = ref<HederaAccount[]>([]);

/* Computed */
const formattedAccountIds = computed(() =>
  (
    props.items ||
    accoundIds.value.map(a => a.account_id).concat(user.publicKeysToAccountsFlattened)
  ).map(id => getAccountIdWithChecksum(id)),
);

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

/* Hooks */
onBeforeMount(async () => {
  if (isUserLoggedIn(user.personal)) {
    accoundIds.value = await getAll({
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
    :items="formattedAccountIds"
    :data-testid="dataTestid"
    disable-spaces
    v-bind="$attrs"
  />
</template>
