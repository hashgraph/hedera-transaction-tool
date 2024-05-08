<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { HederaAccount } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { getAll } from '@renderer/services/accountsService';

import { isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

/* Props */
const props = defineProps<{
  accountId: string;
  selectDefault?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:accountId']);

/* Stores */
const user = useUserStore();

/* State */
const linkedAccounts = ref<HederaAccount[]>([]);

/* Computed */
const accoundIds = computed(() =>
  user.publicKeyToAccounts
    .map(a => a.accounts)
    .flat()
    .filter(acc => !acc.deleted && acc.account !== null)
    .map(acc => acc.account || '')
    .filter(acc => acc !== null),
);

/* Handlers */
const handleAccountIdChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  emit('update:accountId', selectEl.value);
};

/* Hooks */
onBeforeMount(async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  linkedAccounts.value = await getAll(user.personal.id);

  if (props.accountId.length === 0 && props.selectDefault) {
    emit('update:accountId', accoundIds.value[0]);
  }
});

/* Watchers */
watch(
  () => user.publicKeyToAccounts,
  () => {
    if ((!props.accountId || props.accountId?.length === 0) && props.selectDefault) {
      emit('update:accountId', accoundIds.value[0]);
    }
  },
);
</script>

<template>
  <select class="form-select is-fill" :value="accountId" @change="handleAccountIdChange">
    <template v-for="accountId in accoundIds" :key="accountId">
      <option :value="accountId">
        {{ accountId }}
        {{
          linkedAccounts.find(la => la.account_id === accountId)
            ? `(${linkedAccounts.find(la => la.account_id === accountId)?.nickname})`
            : ''
        }}
      </option>
    </template>
  </select>
</template>
