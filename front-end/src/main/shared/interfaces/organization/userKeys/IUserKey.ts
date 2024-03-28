export interface IUserKey {
  id: number;
  userId: number;
  mnemonicHash?: string;
  index?: number;
  publicKey: string;
  deletedAt?: string;
}
