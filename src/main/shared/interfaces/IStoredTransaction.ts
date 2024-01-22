import { JSONSchema } from 'json-schema-typed';

export interface IStoredTransaction {
  mode: 'personal' | 'organization';
  timestamp: number;
  status: number;
  type: string;
  transactionId: string;
  group?: string;
  serverUrl?: string;
}

export const storedTransactionJSONSchema: JSONSchema = {
  type: 'object',
  properties: {
    mode: {
      type: 'string',
    },
    timestamp: {
      type: 'number',
    },
    status: {
      type: 'number',
    },
    type: {
      type: 'string',
    },
    transactionId: {
      type: 'string',
    },
    group: {
      type: 'string',
    },
    serverUrl: {
      type: 'string',
    },
  },
};
