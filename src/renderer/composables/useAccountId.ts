import { computed, ref, watch } from 'vue';

import { AccountId, Hbar } from '@hashgraph/sdk';

import { IMirrorNodeAccountInfo, IMirrorNodeAllowance } from '../../main/shared/interfaces';

import useNetworkStore from '../stores/storeNetwork';

import { getAccountAllowances, getAccountInfo } from '../services/mirrorNodeDataService';
import { flattenKeyList } from '../services/keyPairService';

export default function useAccountId() {
  const networkStore = useNetworkStore();

  /* State */
  const accountId = ref<string>('');
  const accountInfo = ref<IMirrorNodeAccountInfo | null>(null);
  const allowances = ref<IMirrorNodeAllowance[]>([]);

  const accountInfoController = ref<AbortController | null>(null);
  const allowancesController = ref<AbortController | null>(null);

  /* Computed */
  const isValid = computed(() => Boolean(accountInfo.value));
  const accountIdFormatted = computed(() =>
    isValid.value ? AccountId.fromString(accountId.value).toString() : accountId.value,
  );
  const key = computed(() => accountInfo.value?.key);
  const keysFlattened = computed(() =>
    accountInfo.value?.key
      ? flattenKeyList(accountInfo.value?.key).map(pk => pk.toStringRaw())
      : [],
  );

  /* Getters */
  const getSpenderAllowance = (spenderId: string | AccountId) =>
    Hbar.fromTinybars(
      allowances.value.find(al => al.spender === spenderId.toString())?.amount || 0,
    );

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

  /* Functions */
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

  return {
    accountId,
    accountInfo,
    accountIdFormatted,
    key,
    keysFlattened,
    allowances,
    isValid,
    getSpenderAllowance,
  };
}
