import { IKeyPair } from './IKeyPair';

export interface IStoredSecretHash {
  name?: string;
  secretHash: string;
  keyPairs: IKeyPair[];
}
