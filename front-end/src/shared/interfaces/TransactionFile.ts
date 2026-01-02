export interface TransactionFile {
  network: string;
  items: TransactionFileItem[];
}

export interface TransactionFileItem {
  name: string;
  description: string;
  transactionBytes: string;
  creatorEmail: string;
}
