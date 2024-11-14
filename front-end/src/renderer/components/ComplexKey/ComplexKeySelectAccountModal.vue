<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { computed, onMounted, ref } from 'vue';

import { Key } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import useAccountId from '@renderer/composables/useAccountId';

import { getAll } from '@renderer/services/accountsService';

import { formatAccountId, isAccountId, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppListItem from '@renderer/components/ui/AppListItem.vue';

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
const network = useNetworkStore();

/* State */
const accounts = ref<HederaAccount[]>([]);

/* Computed */
const accountIdsList = computed(() => {
  const keyPairsAccountIds = user.publicKeyToAccounts
    .map(a => a.accounts)
    .flat()
    .filter(
      acc =>
        acc.account !== null && !accounts.value.some(account => account.account_id === acc.account),
    )
    .map(account => ({ accountId: account.account || '', nickname: '' }));

  return accounts.value
    .map(account => ({ accountId: account.account_id, nickname: account.nickname }))
    .concat(keyPairsAccountIds);
});
/* Handlers */
const handleShowUpdate = (show: boolean) => emit('update:show', show);

const handleInsert = async (e: Event) => {
  e.preventDefault();

  if (!isAccountId(selectedAccountData.accountId.value)) {
    throw new Error('Invalid Account ID');
  }

  if (!selectedAccountData.key.value) {
    throw new Error('Invalid key');
  }

  props.onSelectAccount(selectedAccountData.key.value);
};

/* Hooks */
onMounted(async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  accounts.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
  });
});
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="medium-modal">
    <div class="p-4">
      <form @submit="handleInsert">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">Add Account</h1>
        <div class="mt-5">
          <AppInput
            :model-value="
              selectedAccountData.isValid.value
                ? selectedAccountData.accountIdFormatted.value
                : selectedAccountData.accountId.value
            "
            @update:model-value="v => (selectedAccountData.accountId.value = formatAccountId(v))"
            filled
            type="text"
            data-testid="input-complex-key-account-id"
            placeholder="Enter Account ID"
          />
        </div>
        <hr class="separator my-5" />
        <div>
          <!-- <h3 class="text-small">Recent</h3> -->
          <div class="mt-4 overflow-auto" :style="{ height: '158px' }">
            <template v-for="account in accountIdsList" :key="account.accountId">
              <AppListItem
                class="mt-3"
                :selected="account.accountId === selectedAccountData.accountId.value"
                :value="account.accountId"
                @click="selectedAccountData.accountId.value = account.accountId"
              >
                <p>
                  {{ account.accountId }}
                  <span v-if="account.nickname?.trim() && account.nickname.trim().length > 0"
                    >({{ account.nickname }})</span
                  >
                </p>
              </AppListItem>
            </template>
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" type="button" @click="handleShowUpdate(false)"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            data-testid="button-insert-account-id"
            type="submit"
            :disabled="!selectedAccountData.isValid.value"
            >Insert</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
