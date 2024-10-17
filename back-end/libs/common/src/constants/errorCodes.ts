export enum ErrorCodes {
  NPMOP = 'NPMOP',
  INOP = 'INOP',
  UNKWN = 'UNKWN',
  SNMP = 'SNMP',
}

export const ErrorMessages: { [key in ErrorCodes]: string } = {
  [ErrorCodes.NPMOP]: 'New password should not be the old password',
  [ErrorCodes.INOP]: 'Invalid old password',
  [ErrorCodes.UNKWN]: 'Unknown error',
  [ErrorCodes.SNMP]: 'The signature does not match the public key',
};
