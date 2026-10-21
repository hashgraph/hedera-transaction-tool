import { AccountId } from '@hiero-ledger/sdk';

export const accountId = AccountId.fromString('0.0.123');

export const nonFormattedDecode = `{
  "accountNum": {
    "low": 123,
    "high": 0,
    "unsigned": false
  }
}`;

export const buffer = Buffer.from(nonFormattedDecode, 'utf-8');
