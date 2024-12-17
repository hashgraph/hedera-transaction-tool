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

export interface IUserKeyWithNickname extends IUserKey {
  nickname: string | null;
}

export interface IDecryptedKey {
  fileName: string;
  privateKey: string;
  recoveryPhraseHashCode: number | null;
  index: number | null;
}

/* Classes */
export class DecryptedKeyWithPublic {
  fileName: string;
  publicKey: string;
  filepath: string;
  constructor(fileName: string, publicKey: string, filepath: string) {
    this.fileName = fileName;
    this.publicKey = publicKey;
    this.filepath = filepath;
  }
}
