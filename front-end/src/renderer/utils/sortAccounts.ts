import { AccountId } from '@hiero-ledger/sdk';

export function compareAccountIds(a1: AccountId | string, a2: AccountId | string): number {
  let result: number;

  try {
    const id1 = a1 instanceof AccountId ? a1 : AccountId.fromString(a1);
    const id2 = a2 instanceof AccountId ? a2 : AccountId.fromString(a2);
    if (!id1.realm.eq(id2.realm)) {
      result = id1.realm.lt(id2.realm) ? -1 : 1;
    } else if (!id1.shard.eq(id2.shard)) {
      result = id1.shard.lt(id2.shard) ? -1 : 1;
    } else if (!id1.num.eq(id2.num)) {
      result = id1.num.lt(id2.num) ? -1 : 1;
    } else {
      result = 0;
    }
  } catch {
    // Emergency code
    result = a1.toString().localeCompare(a2.toString());
  }

  return result;
}
