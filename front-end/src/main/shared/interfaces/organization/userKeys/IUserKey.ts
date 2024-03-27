export interface IUserKey {
  id: number;
  userId: number;
  publicKey: string;
  index?: number;
  recoveryPhraseHash?: string;
  deletedAt?: Date;
}
