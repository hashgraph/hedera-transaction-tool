import type { IUserKey, IUserKeyWithMnemonic } from '@main/shared/interfaces';

export const userKeyHasMnemonic = (userKey: IUserKey): userKey is IUserKeyWithMnemonic => {
  if (!!userKey.mnemonicHash && userKey.index !== undefined) {
    return true;
  } else {
    return false;
  }
};
