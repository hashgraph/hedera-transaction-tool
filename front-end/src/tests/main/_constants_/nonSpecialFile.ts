import { AccountId } from '@hashgraph/sdk';

export const accountId = AccountId.fromString('0.0.123');

export const nonFormattedDecode = `{
  "shardNum": {
    "low": 0,
    "high": 0,
    "unsigned": false
  },
  "realmNum": {
    "low": 0,
    "high": 0,
    "unsigned": false
  },
  "accountNum": {
    "low": 123,
    "high": 0,
    "unsigned": false
  }
}`;

export const buffer = Buffer.from(nonFormattedDecode, 'utf-8');
