import type { IAccountInfoParsed, CryptoAllowance } from '@main/shared/interfaces';

import { computed, ref, watch } from 'vue';
import { AccountId, Client, Hbar } from '@hashgraph/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { openExternal } from '@renderer/services/electronUtilsService';
import { getAccountAllowances, getAccountInfo } from '@renderer/services/mirrorNodeDataService';
import { flattenKeyList } from '@renderer/services/keyPairService';

import { stringifyHbar } from '@renderer/utils';

export default function useAccountId() {
  /* Stores */
  const networkStore = useNetworkStore();

  /* State */
  const accountId = ref<string>('');
  const accountInfo = ref<IAccountInfoParsed | null>(null);
  const allowances = ref<CryptoAllowance[]>([]);

  const accountInfoController = ref<AbortController | null>(null);
  const allowancesController = ref<AbortController | null>(null);

  /* Computed */
  const isValid = computed(() => Boolean(accountInfo.value));

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

  const accoundIdWithChecksum = computed(() => {
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

  const key = computed(() => accountInfo.value?.key);
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

    try {
      const baseId = newAccountId.split('-')[0];
      AccountId.fromString(baseId);

      accountInfoController.value = new AbortController();
      const accountInfoRes = await getAccountInfo(
        baseId,
        networkStore.mirrorNodeBaseURL,
        accountInfoController.value,
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
    if (accountInfo.value?.stakedNodeId) {
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

  function validateAccountIdChecksum(accountId: string): boolean {
    try {
      const [baseId, checksum] = accountId.split('-');

      const parsedAccountId = AccountId.fromString(baseId);
      const calculatedChecksum = parsedAccountId
        .toStringWithChecksum(networkStore.client as Client)
        .split('-')[1];

      return checksum === calculatedChecksum;
    } catch {
      return false;
    }
  }

  const getAccountIdWithChecksum = (accountId: string): string => {
    try {
      return AccountId.fromString(accountId).toStringWithChecksum(networkStore.client as Client);
    } catch {
      return accountId;
    }
  };

  return {
    accountId,
    accountInfo,
    accountIdFormatted,
    accoundIdWithChecksum,
    autoRenewPeriodInDays,
    key,
    keysFlattened,
    allowances,
    isValid,
    getSpenderAllowance,
    getStakedToString,
    getFormattedPendingRewards,
    openAccountInHashscan,
    validateAccountIdChecksum,
    getAccountIdWithChecksum,
  };
}
