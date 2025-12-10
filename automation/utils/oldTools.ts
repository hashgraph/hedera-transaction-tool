import { ElectronApplication } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/* Old Tools Constants */
const DEFAULT_FOLDER_NAME = 'TransactionTools';
const FILES = 'Files';
const USER_PROPERTIES = 'user.properties';
const RECOVERY_FILE_PARENT_FOLDER = '.System';
const RECOVERY_FILE = 'recovery.aes';

/**
 * Finds the base path for the data migration files
 * @returns {string} - The path of the migration files
 */
export async function getBasePath(app: ElectronApplication): Promise<string> {
  const documents = await app.evaluate(async ({ app }) => {
    return app.getPath('documents');
  });

  return path.join(documents, DEFAULT_FOLDER_NAME);
}

/**
 * Check if the data migration files exist
 * @param {import('playwright').ElectronApplication} app - Electron app object
 * @returns {boolean} - True if the files exist, false otherwise
 */
export async function migrationDataExists(app: ElectronApplication): Promise<boolean> {
  try {
    const basePath = await getBasePath(app);

    const propertiesPath = path.join(basePath, FILES, USER_PROPERTIES);
    const mnemonicPath = path.join(basePath, FILES, RECOVERY_FILE_PARENT_FOLDER, RECOVERY_FILE);

    return fs.existsSync(basePath) && fs.existsSync(propertiesPath) && fs.existsSync(mnemonicPath);
  } catch {
    return false;
  }
}
