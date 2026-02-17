import { computed, type ComputedRef, type Ref, ref } from 'vue';
import { type Router } from 'vue-router';
import { defineStore } from 'pinia';
import { TransactionNodeCollection } from '../../../../shared/src/ITransactionNode.ts';

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
    context?: TransactionNodeCollection | string | null,
    topLevel?: boolean,
    replace?: boolean,
  ) => Promise<void>;
  routeUp: (router: Router, nbLevels?: number) => Promise<void>;
  routeToNext: (router: Router) => Promise<void>;
  routeToPrev: (router: Router) => Promise<void>;
  hasNext: ComputedRef<boolean>;
  hasPrev: ComputedRef<boolean>;
  currentIndex: ComputedRef<number>;
  currentCollection: ComputedRef<TransactionNodeId[] | null>;
  contextStack: Ref<(TransactionNodeCollection | string)[]>;
}

const useNextTransactionV2 = defineStore(
  'navigationController',
  (): StoreNextTransactionV2 => {
    /* State */
    const collectionStack = ref<TransactionNodeId[][]>([]);
    const contextStack = ref<(TransactionNodeCollection | string)[]>([]);
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
      context: TransactionNodeCollection | string | null = null,
      topLevel = false,
      replace = false,
    ): Promise<void> => {
      if (topLevel) {
        resetStack();
      }
      if (context !== null) {
        if (
          Object.values(TransactionNodeCollection).includes(context as TransactionNodeCollection)
        ) {
          contextStack.value.push(getCollectionLabel(context as TransactionNodeCollection));
        } else {
          contextStack.value.push(context);
        }
      }
      collectionStack.value.push(collection); // now indexOf() will search collection
      currentIndexStack.value.push(indexOf(current));
      await routeToCurrent(router, replace);
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

    const routeUp = async (router: Router, nbLevels = 1): Promise<void> => {
      while (nbLevels >= 1) {
        if (currentCollection.value !== null && currentIndex.value !== -1) {
          collectionStack.value.pop();
          currentIndexStack.value.pop();
          contextStack.value.pop();
          router.back();
        } else {
          console.warn('There is no up');
        }
        nbLevels--;
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

    const resetStack = () => {
      collectionStack.value = [];
      contextStack.value = [];
      currentIndexStack.value = [];
    };

    const getCollectionLabel = (collection: TransactionNodeCollection): string => {
      let result: string;
      switch (collection) {
        case TransactionNodeCollection.READY_FOR_REVIEW:
          result = 'Ready for Review';
          break;
        case TransactionNodeCollection.READY_TO_SIGN:
          result = 'Ready to Sign';
          break;
        case TransactionNodeCollection.READY_FOR_EXECUTION:
          result = 'Ready for Execution';
          break;
        case TransactionNodeCollection.IN_PROGRESS:
          result = 'In Progress';
          break;
        case TransactionNodeCollection.HISTORY:
          result = 'History';
          break;
      }
      return result;
    };

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
      contextStack,
    };
  },
);

export default useNextTransactionV2;
