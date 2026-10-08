export enum EntityRole {
    // An account that is the subject of the transaction — e.g. the account being
  // updated in AccountUpdate, the account being deleted in AccountDelete, or
  // the account associated with a node in NodeCreate/NodeUpdate
  ACCOUNT = 'account',
  // The account paying the transaction fee
  FEE_PAYER = 'fee_payer',
  FILE = 'file',
  // The node entity (integer node ID) being created, updated, or deleted in
  // node management transactions
  NODE = 'node',
  // An account receiving funds (e.g. credit side of a CryptoTransfer)
  RECEIVER = 'receiver',
  // An account sending funds (e.g. debit side of a CryptoTransfer)
  SENDER = 'sender',
  // token/topic are intentionally omitted: nothing produces them until Token/
  // Consensus Service support lands (see transactions.service.ts's
  // extractTransactionEntities()). Add them back here once that support exists.
}
