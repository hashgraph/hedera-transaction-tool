export enum ErrorCodes {
  NPMOP = 'NPMOP',
  INOP = 'INOP',
  UNKWN = 'UNKWN',
}

export const ErrorMessages: { [key in ErrorCodes]: string } = {
  [ErrorCodes.NPMOP]: 'New password should not be the old password',
  [ErrorCodes.INOP]: 'Invalid old password',
  [ErrorCodes.UNKWN]: 'Unknown error',
};
