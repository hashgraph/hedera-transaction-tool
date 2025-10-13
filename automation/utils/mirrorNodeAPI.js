const axios = require('axios');
const retry = require('async-retry');
const { formatTransactionId } = require('./util');

const getBaseURL = () => {
  const env = process.env.ENVIRONMENT;
  return env.toUpperCase() === 'LOCALNET'
    ? 'http://localhost:8081/api/v1'
    : 'https://testnet.mirrornode.hedera.com/api/v1';
};

const apiCall = async (endpoint, params) => {
  const baseURL = getBaseURL();
  const fullURL = `${baseURL}/${endpoint}`;
  console.log(`Executing API Call: ${fullURL} with params:`, params);
  try {
    const response = await axios.get(fullURL, { params });
    console.log(`API Call successful: ${fullURL}`);
    return response.data;
  } catch (error) {
    throw new Error(`API call failed: ${error.message}`);
  }
};

/**
 * Performs a polling with retry mechanism on the mirror node API endpoint until a condition is met.
 * This function is needed for interacting with the Hedera Mirror Node,
 * where data about transactions (such as account details or transaction statuses) is not immediately available.
 * Since each record file is processed every 2 seconds,
 * immediate API calls for newly created records might not return the expected data until they are fully processed
 * and indexed by the mirror node.
 *
 * @param {string} endpoint - The API endpoint to call.
 * @param {Object} params - The parameters to pass with the API call, usually query parameters.
 * @param {Function} validateResult - A function to validate the result of the API call.
 *    Should return `true` if the result meets the expected conditions, `false` otherwise.
 * @param {number} [timeout=15000] - The maximum time in milliseconds to keep retrying the API call.
 * @param {number} [interval=2500] - The interval in milliseconds between retries.
 * @returns {Promise<Object>} - A promise that resolves with the data from the API once the validation condition is met.
 *    If the timeout is reached without successful validation, the promise rejects.
 *
 * Usage Example:
 * ```
 * pollWithRetry('accounts', { 'account.id': '0.0.1234' }, result => result && result.accounts && result.accounts.length > 0)
 *   .then(data => console.log('Account details:', data))
 *   .catch(error => console.error('Failed to fetch account details:', error));
 * ```
 */
const pollWithRetry = async (
  endpoint,
  params,
  validateResult,
  timeout = 20000,
  interval = 2500,
) => {
  return retry(
    async () => {
      console.log(`Fetching data from ${endpoint}`);
      const result = await apiCall(endpoint, params);
      if (validateResult(result)) {
        console.log(`Validation successful for data from ${endpoint}`);
        return result;
      }
      throw new Error('Data not ready or condition not met');
    },
    {
      retries: Math.floor(timeout / interval),
      minTimeout: interval,
      maxTimeout: interval,
      onRetry: error => {
        console.log(`Retrying due to: ${error.message}`);
      },
    },
  );
};

const getAccountDetails = async accountId => {
  return pollWithRetry(
    'accounts',
    { 'account.id': accountId },
    result => result && result.accounts && result.accounts.length > 0,
  );
};

const getTransactionDetails = async transactionId => {
  const formatedTransactionId = formatTransactionId(transactionId);
  return pollWithRetry(
    `transactions/${formatedTransactionId}`,
    {},
    result => result && result.transactions && result.transactions.length > 0,
  );
};

const getAssociatedAccounts = async publicKey => {
  let allAccounts = [];
  let params = { 'account.publickey': publicKey, order: 'asc' };
  let endpoint = 'accounts';
  const baseURL = getBaseURL();

  do {
    const response = await pollWithRetry(
      endpoint,
      params,
      result => result && result.accounts && result.accounts.length > 0,
    );

    // Extract the account IDs from the response
    const accounts = response.accounts.map(account => account.account);
    allAccounts = allAccounts.concat(accounts);

    // Check if there is a next link in the response to fetch more data
    if (response.links && response.links.next) {
      const nextLink = response.links.next;

      // Dynamically construct the full URL using the base URL
      const nextUrl = new URL(nextLink, baseURL);
      endpoint = nextUrl.pathname.replace('/api/v1/', ''); // Correctly adjust the endpoint
      params = Object.fromEntries(nextUrl.searchParams.entries());
    } else {
      params = null; // Exit loop if there's no next link
    }
  } while (params); // Continue looping if there's more data to fetch

  console.log('Collected all associated accounts:', allAccounts);
  return allAccounts;
};

module.exports = {
  getAccountDetails,
  getTransactionDetails,
  getAssociatedAccounts,
};
