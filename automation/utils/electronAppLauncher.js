const { _electron: electron } = require('playwright');
require('dotenv').config();

async function launchHederaTransactionTool() {
  console.log("process.env.EXECUTABLE_PATH=" + process.env.EXECUTABLE_PATH);
  try {
    const result = electron.launch({
      executablePath: process.env.EXECUTABLE_PATH,
    });
    console.log("result=" + result);
    return result;
  } catch(reason) {
    console.error(reason);
    throw reason;
  }
}

module.exports = { launchHederaTransactionTool };
