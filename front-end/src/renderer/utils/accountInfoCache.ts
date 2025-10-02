import type { IAccountInfoParsed } from '@shared/interfaces';
import { getAccountInfo } from '@renderer/services/mirrorNodeDataService.ts';

export class AccountInfoCache {
  private readonly entries = new Map<string, Promise<IAccountInfoParsed | null>>();

  public async fetch(
    accountId: string,
    mirrorNodeUrl: string,
  ): Promise<IAccountInfoParsed | null> {
    let result = this.entries.get(accountId) ?? null;
    if (result === null) {
      result = getAccountInfo(accountId, mirrorNodeUrl);
      this.entries.set(accountId, result);
    }
    return result;
  }
}
