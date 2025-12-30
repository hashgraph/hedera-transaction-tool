export interface TransactionFile {
  items: TransactionFileItem[];
}

export interface TransactionFileItem {
  name: string;
  description: string;
  transactionBytes: string;
  mirrorNetwork: string;
  creatorEmail: string;
}
