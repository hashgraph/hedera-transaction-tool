import { AccountId, ContractId, FileId, PublicKey } from '@hashgraph/sdk';

export function isEmail(email: string) {
  return /^[A-Za-z0-9_!#$%&'*+/=?`{|}~^.-]+@[A-Za-z0-9.-]+$/.test(email);
}

export function isPasswordStrong(password: string): {
  length: boolean;
  result: boolean;
} {
  const validationRegex = [
    /.{10,}/, // min 10 letters
  ];

  return {
    length: validationRegex[0].test(password),
    result: validationRegex.every(regex => regex.test(password)),
  };
}

export function isPublicKey(key: string) {
  try {
    return Boolean(PublicKey.fromString(key));
  } catch {
    return false;
  }
}

export function isAccountId(id: string) {
  try {
    return Boolean(AccountId.fromString(id));
  } catch {
    return false;
  }
}

export function isFileId(id: string) {
  try {
    return Boolean(FileId.fromString(id));
  } catch {
    return false;
  }
}

export function isContractId(id: string) {
  try {
    return Boolean(ContractId.fromString(id));
  } catch {
    return false;
  }
}

export function isUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
