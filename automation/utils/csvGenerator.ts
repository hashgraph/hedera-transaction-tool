import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GenerateCSVFileOptions {
  senderAccount?: string;
  feePayerAccount?: string | null;
  accountId?: string;
  startingAmount?: number;
  numberOfTransactions?: number;
  fileName?: string;
  date?: string;
  senderTime?: string;
}

/**
 * Generates a CSV file with the specified configuration for transaction groups.
 *
 * @param {string} senderAccount - The sender account in the format "0.0.xxxx". Default value is based on LocalNode usage
 * @param {string} feePayerAccount - The fee payer account in the format "0.0.xxxx". Optional
 * @param {string} accountId - The account ID for the transaction rows, "0.0.xxxx". Default value is based on LocalNode usage
 * @param {number} startingAmount - The amount to start with for the first line.
 * @param {number} numberOfTransactions - The number of transactions in the group.
 * @param {string} [fileName='output.csv'] - The name of the CSV file to create.
 * @param {string} [date='9/4/24'] - The date to use for each transaction line.
 * @param {string} [senderTime='14:35'] - The sending time (static or configurable).
 */

export async function generateCSVFile({
  senderAccount = '0.0.1031',
  feePayerAccount = null,
  accountId = '0.0.1030',
  startingAmount = 1,
  numberOfTransactions = 5,
  fileName = 'output.csv',
  date = '9/4/24',
  senderTime = '14:35',
}: GenerateCSVFileOptions = {}): Promise<string> {
  // Construct the CSV lines
  // Header lines
  const lines = [`Sender Account,${senderAccount},,`, `Sending Time,${senderTime},,`];

  if (feePayerAccount) {
    lines.push(`Fee Payer Account,${feePayerAccount},,`);
  }

  lines.push(`Node IDs,,,`, `AccountID,Amount,Start Date,memo`);

  // Amounts increment by 1 each line
  for (let i = 0; i < numberOfTransactions; i++) {
    const amount = startingAmount + i;
    const memo = `memo line ${i}`;
    lines.push(`${accountId},${amount},${date},${memo}`);
  }

  // Join all lines
  const csvContent = lines.join('\n');

  // Ensure the data directory exists
  const dataDirectory = path.resolve(__dirname, '../data');
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }

  // Write the file
  const filePath = path.resolve(dataDirectory, fileName);
  fs.writeFileSync(filePath, csvContent, 'utf8');

  console.log(`CSV file generated at: ${filePath}`);
  return filePath;
}
