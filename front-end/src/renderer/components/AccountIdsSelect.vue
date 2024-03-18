<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';
import { HederaAccount } from '@prisma/client';
import { getAll } from '@renderer/services/accountsService';

/* Props */
const props = defineProps<{
  accountId: string;
  selectDefault?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:accountId']);

/* Stores */
const user = useUserStore();
const keyPairs = useKeyPairsStore();

/* State */
const linkedAccounts = ref<HederaAccount[]>([]);

/* Computed */
const accoundIds = computed(() =>
  keyPairs.publicKeyToAccounts
    .map(a => a.accounts)
    .flat()
    .filter(acc => !acc.deleted && acc.account !== null)
    .map(account => account.account),
);

/* Handlers */
const handleAccountIdChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  emit('update:accountId', selectEl.value);
};

/* Hooks */
onBeforeMount(async () => {
  linkedAccounts.value = await getAll(user.data.id);

  if (props.accountId.length === 0 && props.selectDefault) {
    emit('update:accountId', accoundIds.value[0]);
  }
});

/* Watchers */
watch(
  () => keyPairs.publicKeyToAccounts,
  () => {
    if (props.accountId.length === 0 && props.selectDefault) {
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
