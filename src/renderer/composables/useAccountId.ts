import { computed, ref, watch } from 'vue';

import { AccountId, Hbar, HbarUnit } from '@hashgraph/sdk';

import { IAccountInfoParsed, CryptoAllowance } from '../../main/shared/interfaces';

import useNetworkStore from '../stores/storeNetwork';

import { openExternal } from '../services/electronUtilsService';
import { getAccountAllowances, getAccountInfo } from '../services/mirrorNodeDataService';
import { flattenKeyList } from '../services/keyPairService';

export default function useAccountId() {
  /* Stores */
  const networkStore = useNetworkStore();

  /* State */
  const accountId = ref<string>('');
  const accountInfo = ref<IAccountInfoParsed | null>(null);
  const allowances = ref<CryptoAllowance[]>([]);

  const accountInfoController = ref<AbortController | null>(null);
  const allowancesController = ref<AbortController | null>(null);

  /* Getters */
  const isValid = computed(() => Boolean(accountInfo.value));

  const accountIdFormatted = computed(() =>
    isValid.value ? AccountId.fromString(accountId.value).toString() : accountId.value,
  );

  const accoundIdWithChecksum = computed(() =>
    isValid.value
      ? accountInfo.value?.accountId.toStringWithChecksum(networkStore.client).split('-')
      : accountIdFormatted.value,
  );

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
      AccountId.fromString(newAccountId);

      accountInfoController.value = new AbortController();
      const accountInfoRes = await getAccountInfo(
        newAccountId,
        networkStore.mirrorNodeBaseURL,
        accountInfoController.value,
      );

      allowancesController.value = new AbortController();
      const accountAllowancesRes = await getAccountAllowances(
        newAccountId,
        networkStore.mirrorNodeBaseURL,
        allowancesController.value,
      );

      accountInfo.value = accountInfoRes;
      allowances.value = accountAllowancesRes;
    } catch (e) {
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
      allowances.value.find(al => al.spender === spenderId.toString())?.amount_granted || 0,
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
      return rewards.toString(HbarUnit.Hbar);
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
  };
}
