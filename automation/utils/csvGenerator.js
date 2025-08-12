const fs = require('fs');
const path = require('path');

/**
 * Generates a CSV file with the specified configuration for transaction groups.
 *
 * @param {string} senderAccount - The sender account in the format "0.0.xxxx". Default value is based on LocalNode usage
 * @param {string} accountId - The account ID for the transaction rows, "0.0.xxxx". Default value is based on LocalNode usage
 * @param {number} startingAmount - The amount to start with for the first line.
 * @param {number} numberOfTransactions - The number of transactions in the group.
 * @param {string} [fileName='output.csv'] - The name of the CSV file to create.
 * @param {string} [date='9/4/24'] - The date to use for each transaction line.
 * @param {string} [senderTime='14:35'] - The sending time (static or configurable).
 */
async function generateCSVFile({
  senderAccount = '0.0.1031',
  accountId = '0.0.1030',
  startingAmount = 1,
  numberOfTransactions = 5,
  fileName = 'output.csv',
  date = '9/4/24',
  senderTime = '14:35',
} = {}) {
  // Construct the CSV lines
  // Header lines
  const lines = [
    `Sender Account,${senderAccount},,`,
    `Sending Time,${senderTime},,`,
    `Node IDs,,,`,
    `AccountID,Amount,Start Date,memo`,
  ];

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
}

module.exports = {
  generateCSVFile,
};
