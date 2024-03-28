import { IUserKey } from '@main/shared/interfaces';
import { getMessageFromIPCError } from '@renderer/utils';

/* User service for organization */

/* Get information about current user */
export const getUserState = async (
  organizationId: string,
  userId: string,
): Promise<{
  passwordTemporary: boolean;
  organizationKeys: IUserKey[];
  secretHashes: string[];
}> => {
  const organizationKeys: IUserKey[] = [];
  const secretHashes: string[] = [];

  try {
    const keys = await window.electronAPI.organization.userKeys.getOwn(organizationId, userId);
    organizationKeys.push(...keys);

    secretHashes.push(
      ...keys.reduce((acc, curr) => {
        if (curr.mnemonicHash && !acc.includes(curr.mnemonicHash)) {
          acc.push(curr.mnemonicHash);
        }
        return acc;
      }, [] as string[]),
    );
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to get user keys from organization'));
  }

  // try {
  //   const _data = await window.electronAPI.organization.user.me(organizationId, userId);
  // } catch (error: any) {
  //   throw Error(getMessageFromIPCError(error, 'Failed to get information about user state'));
  // }

  return {
    passwordTemporary: false,
    organizationKeys,
    secretHashes,
  };
};
