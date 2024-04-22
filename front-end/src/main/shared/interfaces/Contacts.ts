export interface Contact {
  id: string;
  user_id: string;
  key_name: string;
  email: string;
  organization: string | null;
  organization_user_id: string | null;
  associated_accounts: AssociatedAccount[];
  public_keys: ContactPublicKey[];
}

export interface AssociatedAccount {
  id: string;
  contact_id: string;
  account_id: string;
}

export interface ContactPublicKey {
  id: string;
  contact_id: string;
  public_key: string;
}
