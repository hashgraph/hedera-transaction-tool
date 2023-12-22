import { computed, ref, watch } from 'vue';

import { AccountId } from '@hashgraph/sdk';

import { MirrorNodeAccountInfo } from '../interfaces/MirrorNodeAccountInfo';
import { MirrorNodeAllowance } from '../interfaces/MirrorNodeAllowance';

import useNetworkStore from '../stores/storeNetwork';

import { getAccountAllowances, getAccountInfo } from '../services/mirrorNodeDataService';
import { flattenKeyList } from '../services/keyPairService';

export default function useAccountId() {
  const networkStore = useNetworkStore();

  /* State */
  const accountId = ref<string>('');
  const accountInfo = ref<MirrorNodeAccountInfo | null>(null);
  const allowances = ref<MirrorNodeAllowance[]>([]);

  const accountInfoController = ref<AbortController | null>(null);
  const allowancesController = ref<AbortController | null>(null);

  /* Computed */
  const isValid = computed(() => Boolean(accountInfo.value));
  const key = computed(() => accountInfo.value?.key);
  const keysFlattened = computed(() =>
    accountInfo.value?.key
      ? flattenKeyList(accountInfo.value?.key).map(pk => pk.toStringRaw())
      : [],
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

      accountInfo.value = accountInfoRes.data;
      allowances.value = accountAllowancesRes.data;
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

  return { accountId, accountInfo, key, keysFlattened, allowances, isValid };
}
