import { _electron as electron } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export async function launchHederaTransactionTool() {
  return await electron.launch({
    executablePath: process.env.EXECUTABLE_PATH,
  });
}
