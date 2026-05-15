import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  formatTokenAmount,
  MAX_TOKEN_SUPPLY,
  TokenByIdCache,
} from '@renderer/caches/mirrorNode/TokenByIdCache.ts';
import { KeyType } from '@shared/interfaces/ITokenInfo.ts';

describe('TokenByIdCache', () => {
  test('TokenByIdCache.lookup()', async () => {
    const cache = new TokenByIdCache();
    const mirrorNodeUrl = 'https://localhost:3001';

    const mock = new MockAdapter(axios);

    const tokenId = SAMPLE_TOKEN_INFO.token_id;
    const matcher1 = mirrorNodeUrl + '/api/v1/tokens/' + tokenId;
    mock.onGet(matcher1).reply(200, SAMPLE_TOKEN_INFO);

    const tokenInfo = await cache.lookup(tokenId, mirrorNodeUrl);
    expect(tokenInfo).toStrictEqual(SAMPLE_TOKEN_INFO);
    expect(mock.history.length).toEqual(1);
    expect(mock.history[0].url).toStrictEqual(matcher1);
  });

  test('formatTokenAmount', () => {
    const rawAmount = 1550n;
    const formattedAmount = formatTokenAmount(rawAmount, SAMPLE_TOKEN_INFO);
    expect(formattedAmount).toEqual('15.50');
  });

  test('formatTokenAmount + overflow', () => {
    const rawAmount = MAX_TOKEN_SUPPLY + 1n;
    const formattedAmount = formatTokenAmount(rawAmount, SAMPLE_TOKEN_INFO);
    expect(formattedAmount).toEqual('92,233,720,368,547,760.00');
  });
});

const SAMPLE_TOKEN_INFO = {
  admin_key: null,
  auto_renew_account: '0.0.1584',
  auto_renew_period: 7776000,
  created_timestamp: '1708535268.723610618',
  custom_fees: {
    created_timestamp: '1708535268.723610618',
    fixed_fees: [],
    fractional_fees: [],
  },
  decimals: '2',
  deleted: false,
  expiry_timestamp: null,
  fee_schedule_key: null,
  freeze_default: false,
  freeze_key: null,
  initial_supply: '10000',
  kyc_key: null,
  max_supply: '0',
  memo: 'Created by hedera-contract-album',
  metadata: '',
  metadata_key: null,
  modified_timestamp: '1708535268.723610618',
  name: 'Grenoble Le Versoud',
  pause_key: null,
  pause_status: 'NOT_APPLICABLE',
  supply_key: {
    _type: KeyType.ECDSA_SECP256K1,
    key: '03d236ba45caea9dd8053b6b0db1953564a4d06c9fb7dbf93bec499e6362b5b45f',
  },
  supply_type: 'INFINITE',
  symbol: 'LFLG',
  token_id: '0.0.3580228',
  total_supply: '10000',
  treasury_account_id: '0.0.1584',
  type: 'FUNGIBLE_COMMON',
  wipe_key: null,
};
