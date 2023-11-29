import fs from 'fs/promises';
import path from 'path';

import { Mnemonic } from '@hashgraph/sdk';

import { decrypt, encrypt } from '../utils/crypto';

// Recovery Phrase Encrypted File Name
export const recoveryPhraseFileName = 'recoveryPhraseEncryption.json';

// Get Recovery Phrase Encrypted File Path
export const getRecoveryPhraseFilePath = (app: Electron.App) =>
  path.join(app.getPath('userData'), recoveryPhraseFileName);

// Generate Recovery Phrase
export const generateRecoveryPhrase = () => Mnemonic.generate();

// Get stored Recovery Phrase
export const getRecoveryPhrase = async (filePath: string): Promise<string[]> => {
  const encryptedRecoveryPhrase = await fs.readFile(filePath);

  const decryptedRecoveryPhrase = decrypt(
    encryptedRecoveryPhrase,
    process.env.RECOVERY_PHRASE_ENCRYPTION_KEY!,
  );

  return JSON.parse(decryptedRecoveryPhrase);
};

// Encrypt Recovery Phrase
export const encryptRecoveryPhrase = async (filePath: string, recoveryPhrase: string[]) => {
  const encryptedRecoveryPhrase = encrypt(
    JSON.stringify(recoveryPhrase),
    process.env.RECOVERY_PHRASE_ENCRYPTION_KEY!,
  );

  try {
    await fs.writeFile(filePath, encryptedRecoveryPhrase);
    return true;
  } catch (error) {
    return false;
  }
};
