import { AccountId, FileId, PublicKey } from '@hashgraph/sdk';

export function isEmail(email: string) {
  if (/^[A-Za-z0-9_!#$%&'*+/=?`{|}~^.-]+@[A-Za-z0-9.-]+$/.test(email)) {
    return true;
  }
  return false;
}

export function isPasswordStrong(password: string): {
  length: boolean;
  result: boolean;
} {
  const result = {
    length: false,
    result: false,
  };

  const validationRegex = [{ regex: /.{10,}/ }];

  result.length = validationRegex[0].regex.test(password);

  const isStrong = validationRegex.reduce((isStrong, item) => {
    const isValid = item.regex.test(password);
    return isStrong && isValid;
  }, true);

  result.result = isStrong;

  return result;
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

export function isUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}
