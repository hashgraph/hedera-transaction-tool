<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { KeyList, PublicKey, Hbar } from '@hashgraph/sdk';
import { HederaAccount } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';

import { getAll, remove, changeNickname } from '@renderer/services/accountsService';
import { getKeyListLevels } from '@renderer/services/keyPairService';
import { getDollarAmount } from '@renderer/services/mirrorNodeDataService';

import { stringifyHbar, getFormattedDateFromTimestamp } from '@renderer/utils';

import { transactionTypeKeys } from '../CreateTransaction/txTypeComponentMapping';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

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
const toast = useToast();
const accountData = useAccountId();

/* State */
const accounts = ref<HederaAccount[]>([]);
const isKeyStructureModalShown = ref(false);
const isUnlinkAccountModalShown = ref(false);
const isNicknameInputShown = ref(false);
const nicknameInputRef = ref<InstanceType<typeof AppInput> | null>(null);

/* Computed */
const hbarDollarAmount = computed(() => {
  if (!accountData.accountInfo.value) {
    return 0;
  }

  return getDollarAmount(
    networkStore.currentRate,
    accountData.accountInfo.value.balance.toBigNumber(),
  );
});

/* Hooks */
onMounted(async () => {
  if (!user.data.isLoggedIn) {
    throw new Error('Please login');
  }

  accounts.value = await getAll(user.data.id);
  accountData.accountId.value = accounts.value[0]?.account_id || '';
});

/* Handlers */
const handleSelectAccount = (accountId: string) => {
  isNicknameInputShown.value = false;
  accountData.accountId.value = accountId;
};
const handleUnlinkAccount = async () => {
  if (!user.data.isLoggedIn) {
    throw new Error('Please login');
  }

  accounts.value = await remove(user.data.id, accountData.accountIdFormatted.value);

  accountData.accountId.value = accounts.value[0]?.account_id || '';

  isUnlinkAccountModalShown.value = false;

  toast.success('Account Unlinked!', { position: 'bottom-right' });
};

const handleStartNicknameEdit = () => {
  isNicknameInputShown.value = true;

  if (nicknameInputRef.value?.inputRef) {
    const currentNickname =
      accounts.value.find(acc => acc.account_id === accountData.accountIdFormatted.value)
        ?.nickname || '';
    nicknameInputRef.value.inputRef.value = currentNickname;

    setTimeout(() => {
      nicknameInputRef.value?.inputRef?.focus();
    }, 100);
  }
};

const handleChangeNickname = async () => {
  isNicknameInputShown.value = false;

  accounts.value = await changeNickname(
    user.data.id,
    accountData.accountIdFormatted.value,
    nicknameInputRef.value?.inputRef?.value,
  );
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
  <div class="px-6 py-5">
    <div class="container-fluid flex-column-100">
      <div class="d-flex justify-content-between align-items-center">
        <h1 class="text-title text-bold">Accounts</h1>
      </div>
      <div class="row g-0 overflow-hidden mt-6">
        <div class="col-4 col-xxl-3 flex-column-100 overflow-hidden with-border-end pe-4 ps-0">
          <div class="dropdown">
            <AppButton
              color="primary"
              size="large"
              class="w-100 d-flex align-items-center justify-content-center"
              data-bs-toggle="dropdown"
              >Add new</AppButton
            >
            <ul class="dropdown-menu w-100 mt-3">
              <li
                class="dropdown-item cursor-pointer"
                @click="
                  $router.push({
                    name: 'createTransaction',
                    params: {
                      type: transactionTypeKeys.createAccount,
                    },
                  })
                "
              >
                <span class="text-small text-bold">Create New</span>
              </li>
              <li
                class="dropdown-item cursor-pointer mt-3"
                @click="$router.push('accounts/link-existing')"
              >
                <span class="text-small text-bold">Add Existing</span>
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
          <div class="fill-remaining pe-3">
            <template v-for="account in accounts" :key="account.accountId">
              <div
                class="container-card-account overflow-hidden p-4 mt-3"
                :class="{
                  'is-selected': accountData.accountId.value === account.account_id,
                }"
                @click="handleSelectAccount(account.account_id)"
              >
                <p class="text-small text-semi-bold overflow-hidden">{{ account.nickname }}</p>
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
        <div class="col-8 col-xxl-9 flex-column-100 ps-4">
          <Transition name="fade" mode="out-in">
            <div
              v-if="accountData.isValid.value"
              class="container-fluid flex-column-100 position-relative"
            >
              <div class="flex-between-centered flex-wrap gap-3">
                <div class="d-flex align-items-center flex-wrap gap-3">
                  <AppInput
                    v-show="isNicknameInputShown"
                    ref="nicknameInputRef"
                    @blur="handleChangeNickname"
                    :filled="true"
                    placeholder="Enter Nickname"
                  />
                  <p
                    v-if="!isNicknameInputShown"
                    class="text-title text-semi-bold py-3"
                    @dblclick="handleStartNicknameEdit"
                  >
                    <span class="text-truncate">
                      {{
                        accounts.find(
                          acc => acc.account_id === accountData.accountIdFormatted.value,
                        )?.nickname || 'None'
                      }}
                    </span>

                    <span
                      class="bi bi-pencil-square text-main text-primary ms-1 cursor-pointer"
                      @click="handleStartNicknameEdit"
                    ></span>
                  </p>
                </div>
                <div class="d-flex gap-3">
                  <AppButton
                    class="min-w-unset text-danger"
                    color="borderless"
                    @click="isUnlinkAccountModalShown = true"
                    ><span class="bi bi-trash"></span> Remove</AppButton
                  >
                  <div class="border-start ps-3">
                    <div class="dropdown" v-if="!accountData.accountInfo.value?.deleted">
                      <AppButton class="min-w-unset" color="borderless" data-bs-toggle="dropdown"
                        ><span class="bi bi-arrow-repeat"></span> Update</AppButton
                      >
                      <ul class="dropdown-menu mt-3">
                        <li
                          class="dropdown-item cursor-pointer"
                          @click="
                            $router.push({
                              name: 'createTransaction',
                              params: { type: transactionTypeKeys.deleteAccount },
                              query: { accountId: accountData.accountIdFormatted.value },
                            })
                          "
                        >
                          <span class="text-small text-bold">Delete from Network</span>
                        </li>
                        <li
                          class="dropdown-item cursor-pointer mt-3"
                          @click="
                            $router.push({
                              name: 'createTransaction',
                              params: { type: transactionTypeKeys.updateAccount },
                              query: { accountId: accountData.accountIdFormatted.value },
                            })
                          "
                        >
                          <span class="text-small text-bold">Update in Network</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <hr class="separator my-4" />
              <div class="fill-remaining overflow-x-hidden pe-3">
                <div class="row">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">Account ID</p>
                  </div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold">
                      <template
                        v-if="
                          accountData.accoundIdWithChecksum.value &&
                          Array.isArray(accountData.accoundIdWithChecksum.value)
                        "
                      >
                        <span>{{ accountData.accoundIdWithChecksum.value[0] }}</span>
                        <span class="text-secondary"
                          >-{{ accountData.accoundIdWithChecksum.value[1] }}</span
                        >
                      </template>
                      <template v-else
                        ><span>{{ accountData.accoundIdWithChecksum.value }}</span></template
                      >

                      <i
                        class="bi bi-box-arrow-up-right link-primary cursor-pointer ms-2"
                        @click="accountData.openAccountInHashscan"
                      ></i>
                    </p>
                  </div>
                </div>
                <div class="row mt-4">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">EVM Address</p>
                  </div>
                  <div class="col-7">
                    <p class="text-small text-secondary overflow-hidden">
                      0x{{ accountData.accountInfo.value?.evmAddress || 'None' }}
                    </p>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5"><p class="text-small text-semi-bold">Balance</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold">
                      {{
                        stringifyHbar(
                          (accountData.accountInfo.value?.balance as Hbar) || new Hbar(0),
                        )
                      }}
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
                      <span
                        class="link-primary cursor-pointer"
                        @click="isKeyStructureModalShown = true"
                        >See details</span
                      >
                    </template>
                    <template v-else-if="accountData.key.value instanceof PublicKey && true">
                      <p class="text-secondary text-small overflow-hidden">
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
                  <div class="col-5">
                    <p class="text-small text-semi-bold">Auto Renew Period</p>
                  </div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold">
                      <span>{{ accountData.accountInfo.value?.autoRenewPeriod }}s</span>
                      <span class="ms-4">{{ accountData.autoRenewPeriodInDays.value }} days</span>
                    </p>
                  </div>
                </div>
                <hr class="separator my-4" />
                <div class="row">
                  <div class="col-5"><p class="text-small text-semi-bold">Staked to</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold">
                      {{ accountData.getStakedToString() }}
                    </p>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5"><p class="text-small text-semi-bold">Pending Reward</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold">
                      {{ accountData.getFormattedPendingRewards() }}
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
            </div>
          </Transition>

          <KeyStructureModal
            v-if="accountData.isValid.value"
            v-model:show="isKeyStructureModalShown"
            :account-key="accountData.key.value"
          />

          <AppModal v-model:show="isUnlinkAccountModalShown" class="common-modal">
            <div class="modal-body">
              <i
                class="bi bi-x-lg d-inline-block cursor-pointer"
                style="line-height: 16px"
                @click="isUnlinkAccountModalShown = false"
              ></i>
              <div class="text-center">
                <AppCustomIcon :name="'bin'" style="height: 160px" />
              </div>
              <h3 class="text-center text-title text-bold mt-3">Unlink account</h3>
              <p class="text-center text-small text-secondary mt-4">
                Are you sure you want to remove this Account from your Account list?
              </p>
              <hr class="separator my-5" />
              <div class="flex-between-centered gap-4">
                <AppButton color="borderless" @click="isUnlinkAccountModalShown = false"
                  >Cancel</AppButton
                >
                <AppButton :outline="true" color="danger" @click="handleUnlinkAccount"
                  >Unlink</AppButton
                >
              </div>
            </div>
          </AppModal>
        </div>
      </div>
    </div>
  </div>
</template>
