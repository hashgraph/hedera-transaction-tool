import axios from 'axios';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { ITokenInfo } from '@shared/interfaces/ITokenInfo';

export class TokenByIdCache extends EntityCache<string, ITokenInfo | null> {
  //
  // EntityCache
  //

  protected override async load(
    tokenId: string,
    mirrorNodeURL: string,
  ): Promise<ITokenInfo | null> {
    let result: ITokenInfo | null;
    try {
      const url = mirrorNodeURL + '/api/v1/tokens/' + tokenId;
      const response = await axios.get<ITokenInfo>(url);
      result = response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status == 404) {
        result = null;
      } else {
        throw error;
      }
    }
    return result;
  }
}

export const MAX_TOKEN_SUPPLY = 9223372036854775807n;

export function formatTokenAmount(rawAmount: bigint, tokenInfo: ITokenInfo): string {
  let result: string;
  if (rawAmount > MAX_TOKEN_SUPPLY) {
    rawAmount = MAX_TOKEN_SUPPLY;
  }
  const decimalCount = decimalCountFromTokenInfo(tokenInfo);
  const amountFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimalCount,
    maximumFractionDigits: decimalCount,
  });
  if (decimalCount) {
    result = amountFormatter.format(Number(rawAmount) / Math.pow(10, decimalCount));
  } else {
    result = amountFormatter.format(rawAmount);
  }
  return result;
}

export function decimalCountFromTokenInfo(tokenInfo: ITokenInfo): number {
  const result = Number(tokenInfo.decimals);
  return isNaN(result) ? 0 : result;
}
