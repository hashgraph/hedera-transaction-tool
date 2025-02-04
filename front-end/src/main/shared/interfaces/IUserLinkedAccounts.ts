export interface IUserLinkedAccounts {
  id: string;
  network: string;
  user_id: string;
  nickname: string | null;
  created_at: Date;
  account_id: string;
}
