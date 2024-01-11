export interface IKeyPair {
  nickname?: string;
  publicKey: string;
  privateKey: string;
  index: number;
}

export interface IKeyPairWithAccountId extends IKeyPair {
  accountId?: string;
}

export const keyPairJSONSchema = {
  type: 'object',
  properties: {
    nickname: {
      type: 'string',
    },
    publicKey: {
      type: 'string',
    },
    privateKey: {
      type: 'string',
    },
    index: {
      type: 'number',
    },
  },
};
