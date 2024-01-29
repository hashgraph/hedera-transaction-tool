<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Hbar, HbarUnit, KeyList, PublicKey } from '@hashgraph/sdk';

import useUserStore from '../../stores/storeUser';
import useNetworkStore from '../../stores/storeNetwork';

import useAccountId from '../../composables/useAccountId';

import { getAll, remove } from '../../services/accountsService';
import { openExternal } from '../../services/electronUtilsService';
import { getKeyListLevels } from '../../services/keyPairService';
import { getDollarAmount } from '../../services/mirrorNodeDataService';

import { getFormattedDateFromTimestamp } from '../../utils/transactions';

import AppButton from '../../components/ui/AppButton.vue';
import AppModal from '../../components/ui/AppModal.vue';
import KeyStructure from '../../components/KeyStructure.vue';
import { HederaAccount } from '@prisma/client';

/* Enums */
// enum Sorting {
//   AccountIdAsc = 'accountIdAsc',
//   AccountIdDesc = 'accountIdDesc',
//   NicknameAsc = 'nicknameAsc',
//   NicknameDesc = 'nicknameDesc',
// }

/* Stores */
const user = useUserStore();
const networkStore = useNetworkStore();

/* Composables */
const accountData = useAccountId();

/* State */
const accounts = ref<HederaAccount[]>([]);

const hbarDollarAmount = computed(() => {
  if (!accountData.accountInfo.value) {
    return 0;
  }

  return getDollarAmount(
    networkStore.currentRate,
    accountData.accountInfo.value.balance.toBigNumber().toNumber(),
  );
});

const isKeyStructureModalShown = ref(false);
const isUnlinkAccountModalShown = ref(false);

/* Hooks */
onMounted(async () => {
  if (!user.data.isLoggedIn) {
    throw new Error('Please login');
  }

  accounts.value = await getAll(user.data.id);
  accountData.accountId.value = accounts.value[0]?.account_id || '';
});

/* Handlers */
const handleUnlinkAccount = async () => {
  if (!user.data.isLoggedIn) {
    throw new Error('Please login');
  }

  await remove(user.data.email, accountData.accountIdFormatted.value);

  accounts.value = await getAll(user.data.email);
  accountData.accountId.value = accounts.value[0]?.account_id || '';

  isUnlinkAccountModalShown.value = false;
};

// const handleSortAccounts = (sorting: Sorting) => {
//   switch (sorting) {
//     case Sorting.AccountIdAsc:
//       accounts.value = accounts.value.sort(
//         (a, b) => Number(a.accountId.split('.')[2]) - Number(b.accountId.split('.')[2]),
//       );
//       break;
//     case Sorting.AccountIdDesc:
//       accounts.value = accounts.value.sort(
//         (a, b) => Number(b.accountId.split('.')[2]) - Number(a.accountId.split('.')[2]),
//       );
//       break;
//     case Sorting.NicknameAsc:
//       accounts.value = accounts.value
//         .filter(acc => acc.nickname)
//         .sort((a, b) => a.nickname.localeCompare(b.nickname))
//         .concat(accounts.value.filter(acc => !acc.nickname));
//       break;
//     case Sorting.NicknameDesc:
//       accounts.value = accounts.value = accounts.value
//         .filter(acc => acc.nickname)
//         .sort((a, b) => b.nickname.localeCompare(a.nickname))
//         .concat(accounts.value.filter(acc => !acc.nickname));
//       break;
//     default:
//       break;
//   }
// };
</script>
<template>
  <div class="p-5">
    <div class="d-flex justify-content-between align-items-center">
      <h1 class="text-title text-bold">Accounts</h1>
      <div class="d-flex justify-content-end align-items-center">
        <AppButton
          v-if="!accountData.accountInfo.value?.deleted"
          class="me-3"
          color="secondary"
          @click="isUnlinkAccountModalShown = true"
          >Remove</AppButton
        >
        <AppButton
          v-if="!accountData.accountInfo.value?.deleted"
          class="me-3"
          color="secondary"
          @click="
            $router.push({
              name: 'createTransaction',
              params: { type: 'deleteAccount' },
              query: { accountId: accountData.accountIdFormatted.value },
            })
          "
          >Delete</AppButton
        >
        <AppButton
          v-if="!accountData.accountInfo.value?.deleted"
          color="secondary"
          @click="
            $router.push({
              name: 'createTransaction',
              params: { type: 'updateAccount' },
              query: { accountId: accountData.accountIdFormatted.value },
            })
          "
          >Update</AppButton
        >
      </div>
    </div>
    <div class="mt-7 h-100 row">
      <div class="col-4 col-xxl-3 with-border-end pe-4 ps-0">
        <div class="dropdown">
          <AppButton
            color="primary"
            size="large"
            class="w-100 d-flex align-items-center justify-content-center"
            data-bs-toggle="dropdown"
            >Add new</AppButton
          >
          <ul class="dropdown-menu text-small">
            <li class="dropdown-item">
              <RouterLink to="create-transaction/createAccount" class="dropdown-item"
                ><i class="bi bi-plus-lg"></i>
                Create New
              </RouterLink>
            </li>
            <li class="dropdown-item">
              <RouterLink to="accounts/link-existing" class="dropdown-item"
                ><i class="bi bi-plus-lg"></i>
                Link Existing Account
              </RouterLink>
            </li>
          </ul>
        </div>
        <!-- <div class="mt-5">
          <div class="dropdown">
            <AppButton
              class="w-100 d-flex text-dark-emphasis align-items-center justify-content-start border-0"
              data-bs-toggle="dropdown"
              ><i class="bi bi-filter text-headline me-2"></i> Sort by</AppButton
            >
            <ul class="dropdown-menu text-small">
              <li class="dropdown-item" @click="handleSortAccounts(Sorting.AccountIdAsc)">
                Account ID A-Z
              </li>
              <li class="dropdown-item" @click="handleSortAccounts(Sorting.AccountIdDesc)">
                Account ID Z-A
              </li>
              <li class="dropdown-item" @click="handleSortAccounts(Sorting.NicknameAsc)">
                Nickname A-Z
              </li>
              <li class="dropdown-item" @click="handleSortAccounts(Sorting.NicknameDesc)">
                Nickname Z-A
              </li>
            </ul>
          </div>
        </div> -->
        <hr class="separator my-5" />
        <div>
          <template v-for="account in accounts" :key="account.accountId">
            <div
              class="container-card-account p-4 mt-3"
              :class="{
                'is-selected': accountData.accountId.value === account.account_id,
              }"
              @click="accountData.accountId.value = account.account_id"
            >
              <p class="text-small text-semi-bold">{{ account.nickname }}</p>
              <div class="d-flex justify-content-between align-items-center">
                <p class="text-micro text-secondary mt-2">{{ account.account_id }}</p>
                <!-- <p class="text-micro text-success text-bold">
                  {{ accountData.accountInfo.value?.balance }}
                </p> -->
              </div>
            </div>
          </template>
        </div>
      </div>
      <div class="col-8 col-xxl-9 ps-4 pt-0">
        <Transition name="fade" mode="out-in">
          <div v-if="accountData.isValid.value" class="h-100 position-relative">
            <template
              v-if="
                accounts.find(acc => acc.account_id === accountData.accountIdFormatted.value)
                  ?.nickname
              "
            >
              <div class="row">
                <div class="col-5">
                  <p class="text-small text-semi-bold">Nickname</p>
                </div>
                <div class="col-7">
                  <p class="text-small text-semi-bold">
                    {{
                      accounts.find(acc => acc.account_id === accountData.accountIdFormatted.value)
                        ?.nickname
                    }}
                  </p>
                </div>
              </div>
              <hr class="separator my-4" />
            </template>
            <div class="row">
              <div class="col-5">
                <p class="text-small text-semi-bold">Account ID</p>
              </div>
              <div class="col-7">
                <p class="text-small text-semi-bold">
                  {{
                    accountData.accountInfo.value?.accountId.toStringWithChecksum(
                      networkStore.client,
                    )
                  }}
                  <i
                    class="bi bi-box-arrow-up-right link-primary cursor-pointer ms-1"
                    @click="
                      networkStore.network !== 'custom' &&
                        openExternal(`
            https://hashscan.io/${networkStore.network}/account/${accountData.accountIdFormatted.value}`)
                    "
                  ></i>
                </p>
              </div>
            </div>
            <div class="row mt-4">
              <div class="col-5">
                <p class="text-small text-semi-bold">EVM Address</p>
              </div>
              <div class="col-7">
                <p class="text-small text-secondary">
                  0x{{ accountData.accountInfo.value?.evmAddress || 'None' }}
                </p>
              </div>
            </div>
            <div class="mt-4 row">
              <div class="col-5"><p class="text-small text-semi-bold">Balance</p></div>
              <div class="col-7">
                <p class="text-small text-semi-bold">
                  {{ accountData.accountInfo.value?.balance || 'None' }}
                  <span class="text-pink">({{ hbarDollarAmount }})</span>
                </p>
              </div>
            </div>
            <div class="mt-4 row">
              <div class="col-5">
                <p class="text-small text-semi-bold">Key</p>
              </div>
              <div class="col-7">
                <template v-if="accountData.key.value instanceof KeyList && true">
                  Complex Key ({{ getKeyListLevels(accountData.key.value) }} levels)
                  <span class="link-primary cursor-pointer" @click="isKeyStructureModalShown = true"
                    >See details</span
                  >
                </template>
                <template v-else-if="accountData.key.value instanceof PublicKey && true">
                  <p class="text-muted text-small">
                    {{ accountData.key.value.toStringRaw() }}
                  </p>
                  <p class="text-small text-semi-bold text-pink mt-3">
                    {{ accountData.key.value._key._type }}
                  </p>
                </template>
                <template v-else>None</template>
              </div>
            </div>
            <div class="mt-4 row">
              <div class="col-5">
                <p class="text-small text-semi-bold">Receiver Sig. Required</p>
              </div>
              <div class="col-7">
                <p class="text-small text-semi-bold">
                  {{ accountData.accountInfo.value?.receiverSignatureRequired ? 'Yes' : 'No' }}
                </p>
              </div>
            </div>
            <div class="mt-4 row">
              <div class="col-5"><p class="text-small text-semi-bold">Memo</p></div>
              <div class="col-7">
                <p class="text-small text-semi-bold">
                  {{ accountData.accountInfo.value?.memo || 'None' }}
                </p>
              </div>
            </div>
            <div class="mt-4 row">
              <div class="col-5">
                <p class="text-small text-semi-bold">Max. Auto. Association</p>
              </div>
              <div class="col-7">
                <p class="text-small text-semi-bold">
                  {{ accountData.accountInfo.value?.maxAutomaticTokenAssociations }}
                </p>
              </div>
            </div>
            <div class="mt-4 row">
              <div class="col-5"><p class="text-small text-semi-bold">Ethereum Nonce</p></div>
              <div class="col-7">
                <p class="text-small text-semi-bold">
                  {{ accountData.accountInfo.value?.ethereumNonce }}
                </p>
              </div>
            </div>
            <hr class="separator my-4" />
            <div class="row">
              <div class="col-5"><p class="text-small text-semi-bold">Created At</p></div>
              <div class="col-7">
                <p class="text-small text-semi-bold">
                  {{
                    accountData.accountInfo.value?.createdTimestamp
                      ? getFormattedDateFromTimestamp(
                          accountData.accountInfo.value?.createdTimestamp,
                        )
                      : 'None'
                  }}
                </p>
              </div>
            </div>
            <div class="mt-4 row">
              <div class="col-5"><p class="text-small text-semi-bold">Expires At</p></div>
              <div class="col-7">
                <p class="text-small text-semi-bold">
                  {{
                    accountData.accountInfo.value?.expiryTimestamp
                      ? getFormattedDateFromTimestamp(
                          accountData.accountInfo.value?.expiryTimestamp,
                        )
                      : 'None'
                  }}
                </p>
              </div>
            </div>
            <div class="mt-4 row" v-if="accountData.accountInfo.value?.autoRenewPeriod">
              <div class="col-5"><p class="text-small text-semi-bold">Auto Renew Period</p></div>
              <div class="col-7">
                <p class="text-small text-semi-bold"></p>
                <span>{{ accountData.accountInfo.value?.autoRenewPeriod }}s</span>
                <span class="ms-4"
                  >{{
                    (accountData.accountInfo.value?.autoRenewPeriod / 86400).toFixed(0)
                  }}
                  days</span
                >
              </div>
            </div>
            <hr class="separator my-4" />
            <div class="row">
              <div class="col-5"><p class="text-small text-semi-bold">Staked to</p></div>
              <div class="col-7">
                <p class="text-small text-semi-bold">
                  {{
                    accountData.accountInfo.value?.stakedNodeId
                      ? `Node ${accountData.accountInfo.value?.stakedNodeId}`
                      : accountData.accountInfo.value?.stakedAccountId
                  }}
                </p>
              </div>
            </div>
            <div class="mt-4 row">
              <div class="col-5"><p class="text-small text-semi-bold">Pending Reward</p></div>
              <div class="col-7">
                <p class="text-small text-semi-bold">
                  {{
                    (
                      accountData.accountInfo.value?.pendingRewards || Hbar.fromString('0')
                    ).toString(HbarUnit.Hbar)
                  }}
                </p>
              </div>
            </div>
            <div class="mt-4 row">
              <div class="col-5"><p class="text-small text-semi-bold">Rewards</p></div>
              <div class="col-7">
                <p class="text-small text-semi-bold">
                  {{ accountData.accountInfo.value?.declineReward ? 'Declined' : 'Accepted' }}
                </p>
              </div>
            </div>
            <template v-if="accountData.accountInfo.value?.deleted">
              <hr class="separator my-4" />
              <p class="text-danger">Account is deleted</p>
            </template>
          </div>
        </Transition>

        <AppModal
          v-model:show="isKeyStructureModalShown"
          v-if="accountData.isValid.value"
          class="modal-fit-content"
        >
          <div class="p-5">
            <KeyStructure
              v-if="accountData.key.value instanceof KeyList && true"
              :key-list="accountData.key.value"
            />
            <div v-else-if="accountData.key.value instanceof PublicKey && true">
              {{ accountData.key.value.toStringRaw() }}
            </div>
          </div>
        </AppModal>
        <AppModal v-model:show="isUnlinkAccountModalShown" class="common-modal">
          <div class="modal-body">
            <i
              class="bi bi-x-lg d-inline-block cursor-pointer"
              style="line-height: 16px"
              @click="isUnlinkAccountModalShown = false"
            ></i>
            <div class="text-center mt-5">
              <i class="bi bi-trash large-icon" style="line-height: 16px"></i>
            </div>
            <h3 class="text-center text-title text-bold mt-5">Delete account</h3>
            <p class="text-center text-small text-secondary mt-4">
              Are you sure you want to remove account?
            </p>
            <hr class="separator my-5" />
            <div class="d-grid">
              <AppButton color="primary" @click="handleUnlinkAccount">Confirm</AppButton>
              <AppButton color="secondary" class="mt-4" @click="isUnlinkAccountModalShown = false"
                >Cancel</AppButton
              >
            </div>
          </div>
        </AppModal>
      </div>
    </div>
  </div>
</template>
