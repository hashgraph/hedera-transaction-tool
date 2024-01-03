export interface IKeyPair {
  nickname?: string;
  publicKey: string;
  privateKey: string;
  index: number;
}

export interface IKeyPairWithAccountId extends IKeyPair {
  accountId?: string;
}
