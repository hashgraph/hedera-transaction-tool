<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { computed, onBeforeMount, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/accountsService';

import { flattenAccountIds, getAccountIdWithChecksum, isUserLoggedIn } from '@renderer/utils';

/* Props */
const props = defineProps<{
  accountId: string;
  selectDefault?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:accountId', accountId: string): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const linkedAccounts = ref<HederaAccount[]>([]);

/* Computed */
const accoundIds = computed(() => flattenAccountIds(user.publicKeyToAccounts));

/* Handlers */
const handleAccountIdChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  const idWithoutChecksum = selectEl.value.split('-')[0];
  emit('update:accountId', idWithoutChecksum || '');
};

/* Hooks */
onBeforeMount(async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  linkedAccounts.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
  });

  if (props.accountId.length === 0 && props.selectDefault) {
    emit('update:accountId', accoundIds.value[0] || '');
  }
});

/* Watchers */
watch(
  () => user.publicKeyToAccounts,
  () => {
    const accountId = props.accountId?.trim() || '';

    if ((accountId.length === 0 && props.selectDefault) || !accoundIds.value.includes(accountId)) {
      emit('update:accountId', accoundIds.value[0]);
    }
  },
);
</script>

<template>
  <select
    class="form-select is-fill"
    data-testid="dropdown-payer"
    :value="accountId"
    @change="handleAccountIdChange"
  >
    <template v-for="accountId in accoundIds" :key="accountId">
      <option :value="accountId">
        {{
          (linkedAccounts.find(la => la.account_id === accountId)?.nickname?.trim() || '').length >
          0
            ? `${linkedAccounts.find(la => la.account_id === accountId)?.nickname}`
            : ''
        }}
        {{
          (linkedAccounts.find(la => la.account_id === accountId)?.nickname?.trim() || '').length >
          0
            ? `(${getAccountIdWithChecksum(accountId)})`
            : `${getAccountIdWithChecksum(accountId)}`
        }}
      </option>
    </template>
  </select>
</template>
