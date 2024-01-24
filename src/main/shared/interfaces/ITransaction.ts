import { JSONSchema } from 'json-schema-typed';

export interface ITransaction {
  id: string;
  name: string;
  type: string;
  description: string;
  transaction_id: string;
  transaction_hash: string;
  body: string;
  status: string;
  status_code: string;
  user_id: string;
  key_id: string;
  signature: string;
  valid_start: string;
  executed_at: string;
  created_at: string;
  updated_at: string;
  group_id?: string;
}

export const transactionJSONSchema: JSONSchema = {
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string' },
    description: { type: 'string' },
    transaction_id: { type: 'string' },
    transaction_hash: { type: 'string' },
    body: { type: 'string' },
    status: { type: 'string' },
    status_code: { type: 'string' },
    user_id: { type: 'string' },
    key_id: { type: 'string' },
    signature: { type: 'string' },
    valid_start: { type: 'string' },
    executed_at: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    group_id: { type: 'string' },
  },
  required: [
    'id',
    'name',
    'type',
    'description',
    'transaction_id',
    'transaction_hash',
    'body',
    'status',
    'status_code',
    'user_id',
    'key_id',
    'signature',
    'valid_start',
    'executed_at',
    'created_at',
    'updated_at',
  ],
  additionalProperties: false,
};
