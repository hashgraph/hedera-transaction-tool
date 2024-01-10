import { IKeyPair } from './';

export interface IStoredSecretHash {
  name?: string;
  secretHash: string;
  keyPairs: IKeyPair[];
}
