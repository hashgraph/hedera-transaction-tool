const { _electron: electron } = require('playwright');
require('dotenv').config();

async function launchHederaTransactionTool() {
  return await electron.launch({
    executablePath: process.env.EXECUTABLE_PATH,
  });
}

module.exports = { launchHederaTransactionTool };
