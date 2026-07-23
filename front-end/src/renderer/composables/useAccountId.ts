import type { IAccountInfoParsed, CryptoAllowance } from '@shared/interfaces';

import { computed, ref, watch, type Ref } from 'vue';
import { AccountId, Client, Hbar, Key } from '@hiero-ledger/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { openExternal } from '@renderer/services/electronUtilsService';
import { getAccountAllowances } from '@renderer/services/mirrorNodeDataService';
import { flattenKeyList } from '@renderer/services/keyPairService';

import { stringifyHbar } from '@renderer/utils';
import { AppCache } from '@renderer/caches/AppCache';

export interface AccountIdStore {
  accountId: Ref<string>;
  accountInfo: Ref<IAccountInfoParsed | null>;
  accountIdFormatted: Ref<string>;
  accountIdWithChecksum: Ref<string | string[] | undefined>;
  autoRenewPeriodInDays: Ref<string>;
  key: Ref<Key | null>;
  keysFlattened: Ref<string[]>;
  allowances: Ref<CryptoAllowance[]>;
  isValid: Ref<boolean>;
  isLoading: Ref<boolean>;
  getSpenderAllowance: (spenderId: string | AccountId) => Hbar;
  getStakedToString: () => string;
  getFormattedPendingRewards: () => string;
  openAccountInHashscan: () => void;
}

export default function useAccountId(): AccountIdStore {
  /* Stores */
  const networkStore = useNetworkStore();

  /* State */
  const accountId = ref<string>('');
  const accountInfo: Ref<IAccountInfoParsed | null> = ref(null);
  const allowances = ref<CryptoAllowance[]>([]);
  const loading = ref<boolean>(false);

  const accountInfoController = ref<AbortController | null>(null);
  const allowancesController = ref<AbortController | null>(null);

  /* Computed */
  const isValid = computed(() => accountInfo.value !== null);
  const isLoading = computed(() => loading.value);

  /* Injected */
  const accountByIdCache = AppCache.inject().mirrorAccountById;

  const accountIdFormatted = computed(() => {
    if (!isValid.value) {
      return accountId.value;
    }

    try {
      const parsedAccountId = AccountId.fromString(accountId.value);

      return accountId.value.includes('-') ? accountId.value : parsedAccountId.toString();
    } catch {
      return accountId.value;
    }
  });

  const accountIdWithChecksum = computed(() => {
    try {
      return isValid.value
        ? accountInfo.value?.accountId
            .toStringWithChecksum(networkStore.client as Client)
            .split('-')
        : accountIdFormatted.value;
    } catch {
      return accountIdFormatted.value;
    }
  });

  const autoRenewPeriodInDays = computed(() =>
    ((accountInfo.value?.autoRenewPeriod || 0) / 86400).toFixed(0),
  );

  const key = computed(() => accountInfo.value?.key ?? null);
  const keysFlattened = computed(() => {
    if (accountInfo.value?.key) {
      return flattenKeyList(accountInfo.value?.key).map(pk => pk.toStringRaw());
    } else {
      return [];
    }
  });

  /* Watchers */
  watch(accountId, async newAccountId => {
    cancelPreviousRequests();

    if (!newAccountId) return resetData();

    loading.value = true;
    try {
      const baseId = newAccountId.split('-')[0];
      AccountId.fromString(baseId);

      accountInfoController.value = new AbortController();
      const accountInfoRes = await accountByIdCache.lookup(
        baseId,
        networkStore.mirrorNodeBaseURL,
        true /* To get the latest balance */
      );

      allowancesController.value = new AbortController();
      const accountAllowancesRes = await getAccountAllowances(
        baseId,
        networkStore.mirrorNodeBaseURL,
        allowancesController.value,
      );

      accountInfo.value = accountInfoRes;
      allowances.value = accountAllowancesRes;
    } catch {
      resetData();
    } finally {
      loading.value = false;
    }
  });

  /* Misc */
  function resetData() {
    accountInfo.value = null;
    allowances.value = [];
  }

  function cancelPreviousRequests() {
    accountInfoController.value?.abort();
    allowancesController.value?.abort();

    accountInfoController.value = null;
    allowancesController.value = null;
  }

  function getSpenderAllowance(spenderId: string | AccountId) {
    return Hbar.fromTinybars(
      allowances.value.find(al => al.spender === spenderId.toString())?.amount || 0,
    );
  }

  function getStakedToString() {
    if (accountInfo.value?.stakedNodeId != null) {
      return `Node ${accountInfo.value?.stakedNodeId}`;
    } else if (accountInfo.value?.stakedAccountId) {
      return `Account ${accountInfo.value?.stakedAccountId}`;
    } else {
      return 'None';
    }
  }

  function getFormattedPendingRewards() {
    const rewards = accountInfo.value?.pendingRewards;
    if (rewards) {
      return stringifyHbar(rewards as Hbar);
    } else {
      return Hbar.fromString('0').toString();
    }
  }

  function openAccountInHashscan() {
    networkStore.network !== 'custom' &&
      openExternal(`
            https://hashscan.io/${networkStore.network}/account/${accountIdFormatted.value}`);
  }

  return {
    accountId,
    accountInfo,
    accountIdFormatted,
    accountIdWithChecksum,
    autoRenewPeriodInDays,
    key,
    keysFlattened,
    allowances,
    isValid,
    isLoading,
    getSpenderAllowance,
    getStakedToString,
    getFormattedPendingRewards,
    openAccountInHashscan,
  };
}
