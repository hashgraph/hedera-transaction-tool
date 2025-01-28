<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';
import type { AccountInfo } from '@main/shared/interfaces';

import { computed, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';

import { add, getAll } from '@renderer/services/accountsService';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';

/* Props */
const props = defineProps<{
  publicKey: string;
  accounts?: AccountInfo[];
  linkedAccounts?: HederaAccount[];
  index: number;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:linkedAccounts', linkedAccounts: HederaAccount[]): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const accountData = useAccountId();

/* State */
const isCollapsed = ref(false);

/* Computed */
const filteredAccounts = computed(
  () =>
    props.accounts?.filter(
      account => !props.linkedAccounts?.some(a => a.account_id === account.account),
    ) || [],
);

/* Handlers */
const handleLinkAccount = async (accountId: string) => {
  if (!isUserLoggedIn(user.personal) || !isLoggedInOrganization(user.selectedOrganization)) {
    throw new Error('User is not logged in an organization');
  }

  await add(user.personal.id, accountId, network.network, '');

  toast.success('Account linked successfully');

  emit(
    'update:linkedAccounts',
    await getAll({
      where: {
        user_id: user.personal.id,
        network: network.network,
      },
    }),
  );
};
</script>
<template>
  <Transition name="fade" mode="out-in">
    <div v-if="filteredAccounts && filteredAccounts.length > 0" class="row">
      <div class="col-5 d-flex gap-2 flex-grow-1">
        <span
          v-if="isCollapsed"
          class="bi bi-chevron-up cursor-pointer"
          @click="isCollapsed = !isCollapsed"
        ></span>
        <span
          v-else
          class="bi bi-chevron-down cursor-pointer"
          :data-testid="'span-expand-associated-accounts-' + index"
          @click="isCollapsed = !isCollapsed"
        ></span>
        <p class="text-small text-semi-bold">
          Associated Accounts
          <span class="text-secondary">({{ filteredAccounts.length }})</span>
        </p>
      </div>
      <Transition name="fade" mode="out-in">
        <div class="col-7" v-show="isCollapsed">
          <ul class="d-flex flex-wrap gap-3">
            <template
              v-for="(account, accountIndex) in filteredAccounts"
              :key="`${publicKey}${account.account}`"
            >
              <li class="flex-centered text-center badge-bg rounded py-2 px-3">
                <p
                  class="text-small text-secondary"
                  :data-testid="'p-associated-account-id-' + index + '-' + accountIndex"
                  v-if="account.account"
                >
                  {{ accountData.getAccountIdWithChecksum(account.account) }}
                  <span
                    v-if="
                      (
                        linkedAccounts
                          ?.find(a => a.account_id === account.account)
                          ?.nickname?.trim() || ''
                      ).length > 0
                    "
                    >({{
                      linkedAccounts?.find(a => a.account_id === account.account)?.nickname
                    }})</span
                  >
                </p>
                <span
                  v-if="!linkedAccounts?.some(a => a.account_id === account.account)"
                  class="bi bi-link d-flex cursor-pointer ms-2"
                  @click="account.account && handleLinkAccount(account.account)"
                ></span>
              </li>
            </template>
          </ul>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
