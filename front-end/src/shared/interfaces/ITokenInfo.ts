export interface ITokenInfo {
  admin_key: Key | null;
  auto_renew_account: string | null; // Network entity ID in the format of shard.realm.num
  auto_renew_period: number | null;
  created_timestamp: string;
  decimals: string;
  deleted: boolean | null;
  expiry_timestamp: string | null;
  fee_schedule_key: Key | null;
  freeze_default: boolean;
  freeze_key: Key | null;
  initial_supply: string;
  kyc_key: Key | null;
  max_supply: string;
  metadata: string;
  metadata_key: Key | null;
  modified_timestamp: string;
  name: string;
  memo: string;
  pause_key: Key | null;
  pause_status: string; // NOT_APPLICABLE, PAUSED, UNPAUSED
  supply_key: Key | null;
  supply_type: string; // FINITE, INFINITE
  symbol: string;
  token_id: string | null; // Network entity ID in the format of shard.realm.num
  total_supply: string;
  treasury_account_id: string | null; // Network entity ID in the format of shard.realm.num
  type: string; // FUNGIBLE_COMMON, NON_FUNGIBLE_UNIQUE
  wipe_key: Key | null;
  custom_fees: CustomFees;
}

export interface CustomFees {
  created_timestamp: string;
  fixed_fees: FixedFee[]; // Always present
  fractional_fees?: FractionalFee[]; // Present when FUNGIBLE
  royalty_fees?: RoyaltyFee[]; // Present when NON_FUNGIBLE
}

export interface FixedFee {
  all_collectors_are_exempt: boolean;
  amount: number;
  collector_account_id: string | null; // Network entity ID in the format of shard.realm.num
  denominating_token_id: string | null; // Network entity ID in the format of shard.realm.num
}

export interface FractionalFee {
  all_collectors_are_exempt: boolean;
  amount: FractionAmount;
  collector_account_id: string | null; // Network entity ID in the format of shard.realm.num
  denominating_token_id: string | null; // Network entity ID in the format of shard.realm.num
  maximum: number | null;
  minimum: number;
  net_of_transfers: boolean;
}

export interface RoyaltyFee {
  all_collectors_are_exempt: boolean;
  amount: FractionAmount;
  collector_account_id: string | null; // Network entity ID in the format of shard.realm.num
  fallback_fee: FallbackFee; // Network entity ID in the format of shard.realm.num
}

export interface FallbackFee {
  amount: number;
  denominating_token_id: string | null; // Network entity ID in the format of shard.realm.num
}

export interface FractionAmount {
  numerator: number;
  denominator: number;
}

export interface Key {
  _type: KeyType;
  key: string;
}

export enum KeyType {
  ECDSA_SECP256K1 = 'ECDSA_SECP256K1',
  ED25519 = 'ED25519',
  ProtobufEncoded = 'ProtobufEncoded',
}
