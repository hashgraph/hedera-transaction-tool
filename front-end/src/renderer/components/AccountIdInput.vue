<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/accountsService';

import { formatAccountId, isUserLoggedIn } from '@renderer/utils';

import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';

/* Props */
defineProps<{
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

/* Handlers */
const handleUpdate = (value: string) => {
  emit('update:modelValue', formatAccountId(value));
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
    :model-value="modelValue"
    @update:model-value="handleUpdate"
    :items="items || accoundIds.map(a => a.account_id).concat(user.publicKeysToAccountsFlattened)"
    :data-testid="dataTestid"
    disable-spaces
    v-bind="$attrs"
  />
</template>
