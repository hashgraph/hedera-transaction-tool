export interface IUserKey {
  id: number;
  userId: number;
  mnemonicHash?: string;
  index?: number;
  publicKey: string;
  deletedAt?: string;
}

export interface IUserKeyWithMnemonic extends IUserKey {
  mnemonicHash: string;
  index: number;
}
