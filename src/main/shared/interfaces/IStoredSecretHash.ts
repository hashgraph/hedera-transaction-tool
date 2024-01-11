import { IKeyPair, keyPairJSONSchema } from './';

export interface IStoredSecretHash {
  name?: string;
  secretHash: string;
  keyPairs: IKeyPair[];
}

export const storedSecretHashJSONSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
    },
    secretHash: {
      type: 'string',
    },
    keyPairs: {
      type: 'array',
      items: keyPairJSONSchema,
    },
  },
};
