export interface ITransaction {
  id: string;
  name: string;
  type: string;
  description: string;
  transaction_id: string;
  transaction_hash: string;
  body: string;
  status: string;
  status_code: number;
  user_id: string;
  key_id: string;
  signature: string;
  valid_start: string;
  executed_at: number;
  created_at: number;
  updated_at: number;
  group_id?: string;
}
