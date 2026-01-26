import { computed, type ComputedRef, ref } from 'vue';
import { type Router } from 'vue-router';
import { defineStore } from 'pinia';

export type TransactionNodeId =
  | {
      transactionId: number | string;
      groupId?: never;
    }
  | {
      transactionId?: never;
      groupId: number | string;
    };

export interface StoreNextTransactionV2 {
  routeDown: (
    current: TransactionNodeId,
    collection: TransactionNodeId[],
    router: Router,
  ) => Promise<void>;
  routeUp: (router: Router) => Promise<void>;
  routeToNext: (router: Router) => Promise<void>;
  routeToPrev: (router: Router) => Promise<void>;
  hasNext: ComputedRef<boolean>;
  hasPrev: ComputedRef<boolean>;
  currentIndex: ComputedRef<number>;
  currentCollection: ComputedRef<TransactionNodeId[] | null>;
}

const useNextTransactionV2 = defineStore(
  'navigationController',
  (): StoreNextTransactionV2 => {
    /* State */
    const collectionStack = ref<TransactionNodeId[][]>([]);
    const currentIndexStack = ref<number[]>([]);

    /* Computed */
    const currentCollection = computed(() =>
      collectionStack.value.length > 0
        ? collectionStack.value[collectionStack.value.length - 1]
        : null,
    );
    const currentIndex = computed(() =>
      currentIndexStack.value.length > 0
        ? currentIndexStack.value[currentIndexStack.value.length - 1]
        : -1,
    );

    /* Functions */
    const routeDown = async (
      current: TransactionNodeId,
      collection: TransactionNodeId[],
      router: Router,
    ): Promise<void> => {
      collectionStack.value.push(collection); // now indexOf() will search collection
      currentIndexStack.value.push(indexOf(current));
      await routeToCurrent(router, false);
    };

    const routeToNext = async (router: Router): Promise<void> => {
      if (hasNext.value) {
        const currentIndex = currentIndexStack.value.pop()!;
        currentIndexStack.value.push(currentIndex + 1);
        await routeToCurrent(router, true);
      } else {
        console.warn('There is no next in currentCollection');
      }
    };

    const routeToPrev = async (router: Router): Promise<void> => {
      if (hasPrev.value) {
        const currentIndex = currentIndexStack.value.pop()!;
        currentIndexStack.value.push(currentIndex - 1);
        await routeToCurrent(router, true);
      } else {
        console.warn('There is no prev in currentCollection');
      }
    };

    const routeUp = async (router: Router): Promise<void> => {
      if (currentCollection.value !== null && currentIndex.value !== -1) {
        collectionStack.value.pop();
        currentIndexStack.value.pop();
        router.back();
      } else {
        console.warn('There is no up');
      }
    };

    const hasPrev = computed<boolean>(() => {
      return currentIndex.value - 1 >= 0;
    });

    const hasNext = computed<boolean>(() => {
      const nodeCount = currentCollection.value?.length ?? 0;
      return currentIndex.value !== -1 && currentIndex.value + 1 < nodeCount;
    });

    //
    // Private
    //

    const indexOf = (targetId: TransactionNodeId): number => {
      let result: number;
      if (currentCollection.value !== null) {
        result = currentCollection.value.findIndex((tnId: TransactionNodeId): boolean => {
          return tnId.transactionId === targetId.transactionId && tnId.groupId === targetId.groupId;
        });
      } else {
        result = -1;
      }
      return result;
    };

    const routeToCurrent = async (router: Router, replace: boolean): Promise<void> => {
      if (currentCollection.value !== null && currentIndex.value < currentCollection.value.length) {
        const nodeId = currentCollection.value[currentIndex.value];
        if (nodeId.transactionId) {
          // Target is a transaction
          await router.push({
            name: 'transactionDetails',
            params: { id: nodeId.transactionId },
            replace,
          });
        } else if (nodeId.groupId) {
          // Target is a group
          await router.push({
            name: 'transactionGroupDetails',
            params: { id: nodeId.groupId },
            replace,
          });
        } else {
          console.warn('Malformed transaction node id: ' + JSON.stringify(nodeId));
        }
      }
    };

    return {
      routeDown,
      routeUp,
      routeToNext,
      routeToPrev,
      hasNext,
      hasPrev,
      currentIndex,
      currentCollection,
    };
  },
);

export default useNextTransactionV2;
