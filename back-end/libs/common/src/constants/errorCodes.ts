export enum ErrorCodes {
  NPMOP = 'NPMOP',
  INOP = 'INOP',
  UNKWN = 'UNKWN',
  SNMP = 'SNMP',
  TE = 'TE',
  TEX = 'TEX',
  FST = 'FST',
  OTIP = 'OTIP',
  TNF = 'TNF',
}

export const ErrorMessages: { [key in ErrorCodes]: string } = {
  [ErrorCodes.NPMOP]: 'New password should not be the old password',
  [ErrorCodes.INOP]: 'Invalid old password',
  [ErrorCodes.UNKWN]: 'Unknown error',
  [ErrorCodes.SNMP]: 'The signature does not match the public key',
  [ErrorCodes.TE]: 'Transaction is expired',
  [ErrorCodes.TEX]: 'Transaction already exists',
  [ErrorCodes.FST]: 'Failed to save transaction',
  [ErrorCodes.OTIP]: 'Only transactions in progress can be canceled',
  [ErrorCodes.TNF]: 'Transaction not found',
};
