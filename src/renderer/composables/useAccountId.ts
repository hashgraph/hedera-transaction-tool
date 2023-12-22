import { computed, ref, watch } from 'vue';

import { AccountId } from '@hashgraph/sdk';

import { MirrorNodeAccountInfo } from '../interfaces/MirrorNodeAccountInfo';
import { MirrorNodeAllowance } from '../interfaces/MirrorNodeAllowance';

import useNetworkStore from '../stores/storeNetwork';

import { getAccountAllowances, getAccountInfo } from '../services/mirrorNodeDataService';
import { flattenKeyList } from '../services/keyPairService';

export default function useAccountId() {
  const networkStore = useNetworkStore();

  const accountId = ref<string>('');
  const accountInfo = ref<MirrorNodeAccountInfo | null>(null);
  const allowances = ref<MirrorNodeAllowance[]>([]);

  const isValid = computed(() => Boolean(accountInfo.value));
  const key = computed(() => accountInfo.value?.key);
  const keysFlattened = computed(() =>
    accountInfo.value?.key
      ? flattenKeyList(accountInfo.value?.key).map(pk => pk.toStringRaw())
      : [],
  );

  watch(accountId, async newAccountId => {
    if (!newAccountId) return resetData();

    try {
      AccountId.fromString(newAccountId);

      accountInfo.value = await getAccountInfo(newAccountId, networkStore.mirrorNodeBaseURL);
      allowances.value = await getAccountAllowances(newAccountId, networkStore.mirrorNodeBaseURL);
    } catch (e) {
      resetData();
    }
  });

  function resetData() {
    accountInfo.value = null;
    allowances.value = [];
  }
  return { accountId, accountInfo, key, keysFlattened, allowances, isValid };
}
