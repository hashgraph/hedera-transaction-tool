import { AccountId, FileId, PublicKey } from '@hashgraph/sdk';

export function isEmail(email: string) {
  if (/^[A-Za-z0-9_!#$%&'*+/=?`{|}~^.-]+@[A-Za-z0-9.-]+$/.test(email)) {
    return true;
  }
  return false;
}

export function isPublicKey(key: string) {
  try {
    return Boolean(PublicKey.fromString(key));
  } catch (error) {
    return false;
  }
}

export function isAccountId(id: string) {
  try {
    return Boolean(AccountId.fromString(id));
  } catch (error) {
    return false;
  }
}

export function isFileId(id: string) {
  try {
    return Boolean(FileId.fromString(id));
  } catch (error) {
    return false;
  }
}
