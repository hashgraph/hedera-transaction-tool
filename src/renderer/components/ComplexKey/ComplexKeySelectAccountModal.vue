<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { Key } from '@hashgraph/sdk';

import { HederaAccount } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import useAccountId from '@renderer/composables/useAccountId';

import { getAll } from '@renderer/services/accountsService';

import { isAccountId } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  onSelectAccount: (key: Key) => void;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Composables */
const selectedAccountData = useAccountId();

/* Stores */
const user = useUserStore();
const keyPairs = useKeyPairsStore();

/* State */
const accounts = ref<HederaAccount[]>([]);
const selectedAccount = ref<string | null>(null);
const search = ref('');

/* Computed */
const accountIdsList = computed(() => {
  const keyPairsAccountIds = keyPairs.accoundIds
    .map(a => a.accountIds)
    .flat()
    .filter(accountId => !accounts.value.some(account => account.account_id === accountId))
    .map(account => ({ accountId: account, nickname: '' }));

  return accounts.value
    .map(account => ({ accountId: account.account_id, nickname: account.nickname }))
    .concat(keyPairsAccountIds);
});
/* Handlers */
const handleShowUpdate = show => emit('update:show', show);

const handleInsert = async (e: Event) => {
  e.preventDefault();

  if (!isAccountId(selectedAccount.value || '')) {
    throw new Error('Invalid Account ID');
  }
  selectedAccountData.accountId.value = selectedAccount.value || '';
};

/* Hooks */
onMounted(async () => {
  accounts.value = await getAll(user.data.id);
});

/* Watchers */
watch(selectedAccountData.key, key => {
  if (key) {
    props.onSelectAccount(key);
    handleShowUpdate(false);
  }
});
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="medium-modal">
    <div class="p-4">
      <form @submit="handleInsert">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
        </div>
        <h1 class="text-title text-center">Add Public Key</h1>
        <div class="mt-5">
          <AppInput v-model:model-value="search" filled type="text" placeholder="Search Accounts" />
        </div>
        <hr class="separator my-5" />
        <div>
          <h3 class="text-small">Recent</h3>
          <div class="mt-4 overflow-auto" :style="{ height: '150px', paddingRight: '10px' }">
            <template
              v-for="account in accountIdsList.filter(
                acc => acc.accountId.includes(search) || acc.nickname.includes(search),
              )"
              :key="account.accountId"
            >
              <div class="mt-3">
                <p
                  class="cursor-pointer"
                  :class="{ 'text-pink': account.accountId === selectedAccount }"
                  @click="selectedAccount = account.accountId"
                >
                  {{ account.accountId }}
                  <span v-if="account.nickname.length > 0">({{ account.nickname }})</span>
                </p>
              </div>
            </template>
          </div>
        </div>
        <hr class="separator my-5" />
        <div class="row justify-content-between">
          <div class="col-4 d-grid">
            <AppButton color="secondary" type="button" @click="handleShowUpdate(false)"
              >Cancel</AppButton
            >
          </div>
          <div class="col-4 d-grid">
            <AppButton
              color="primary"
              type="submit"
              :disabled="!selectedAccount || selectedAccount.length === 0"
              >Insert</AppButton
            >
          </div>
        </div>
      </form>
    </div>
  </AppModal>
</template>
