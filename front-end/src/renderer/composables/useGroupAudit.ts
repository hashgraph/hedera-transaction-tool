import { computed, type ComputedRef, type Ref } from 'vue';
import { getTransactionGroupById, type IGroup } from '@renderer/services/organization';
import useNetworkStore from '@renderer/stores/storeNetwork.ts';

export interface GroupAudit {
  group: ComputedRef<Promise<IGroup | Error | null>>;
  description: ComputedRef<Promise<string|null>>;
}

export default function useGroupAudit(groupId: Ref<number|null>): GroupAudit {

  /* Stores */
  const network = useNetworkStore();

  /* Computed */
  const group = computed(async () => {
    let result: IGroup|Error|null;
    if (groupId.value !== null) {
      try {
        result = await getTransactionGroupById(network.mirrorNodeBaseURL, groupId.value);
      } catch {
        result = new Error("Failed to load group " + groupId.value);
      }
    } else {
      result = null;
    }
    return result;
  })

  const description = computed(async () => {
    const g = await group.value
    return g === null || g instanceof Error ? null : g.description;
  })

  return {
    group,
    description
  }
}

