export enum EntityRole {
  // The account paying the transaction fee
  FEE_PAYER = 'fee_payer',
  // An account sending funds (e.g. debit side of a CryptoTransfer)
  SENDER = 'sender',
  // An account receiving funds (e.g. credit side of a CryptoTransfer)
  RECEIVER = 'receiver',
  // An account that is the subject of the transaction — e.g. the account being
  // updated in AccountUpdate, the account being deleted in AccountDelete, or
  // the account associated with a node in NodeCreate/NodeUpdate
  ACCOUNT = 'account',
  FILE = 'file',
  TOKEN = 'token',
  TOPIC = 'topic',
  // The node entity (integer node ID) being created, updated, or deleted in
  // node management transactions
  NODE = 'node',
}
