import axios from 'axios';
import retry from 'async-retry';

import { DEFAULT_NETWORK, PREVIEWNET, TESTNET } from '../constants/index.js';
import { formatTransactionId, getNetworkEnv } from './automationSupport.js';
import { AccountInfo, AccountsResponse } from '../../front-end/src/shared/interfaces/index.js';

 const getBaseURL = () => {
   const network = getNetworkEnv().toUpperCase();
   switch (network) {
     case TESTNET:
       return 'https://testnet.mirrornode.hedera.com/api/v1';
     case PREVIEWNET:
       return 'https://previewnet.mirrornode.hedera.com/api/v1';
     case DEFAULT_NETWORK:
     default:
       return 'http://localhost:8081/api/v1';
   }
 };

 const apiCall = async (endpoint: string, params: Object) => {
   const baseURL = getBaseURL();
   const fullURL = `${baseURL}/${endpoint}`;
   console.log(`Executing API Call: ${fullURL} with params:`, params);
   try {
     const response = await axios.get(fullURL, { params });
     console.log(`API Call successful: ${fullURL}`);
     return response.data;
   } catch (error: unknown) {
     throw new Error(
       error instanceof Error ? `API call failed: ${error.message}` : 'API call failed',
     );
   }
 };

const summarizeTransactions = (response: any) => {
  return (response?.transactions ?? []).map((transaction: any) => ({
    transaction_id: transaction.transaction_id,
    consensus_timestamp: transaction.consensus_timestamp,
    name: transaction.name,
    result: transaction.result,
  }));
};

const logRecentTransactionsForDebug = async (payerAccountId: string) => {
  try {
    const allTransactions = await apiCall('transactions', { limit: 10, order: 'desc' });
    console.log(
      '[mirror-node-debug] Recent transactions from /transactions:',
      summarizeTransactions(allTransactions),
    );
  } catch (listError) {
    console.log(
      '[mirror-node-debug] Failed to fetch recent transactions from /transactions:',
      listError instanceof Error ? listError.message : listError,
    );
  }

  try {
    const payerTransactions = await apiCall('transactions', {
      'account.id': payerAccountId,
      limit: 10,
      order: 'desc',
    });
    console.log(
      `[mirror-node-debug] Recent transactions from /transactions for payer ${payerAccountId}:`,
      summarizeTransactions(payerTransactions),
    );
  } catch (listError) {
    console.log(
      `[mirror-node-debug] Failed to fetch payer transactions from /transactions for ${payerAccountId}:`,
      listError instanceof Error ? listError.message : listError,
    );
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
 * @param {number} [timeout=30000] - The maximum time in milliseconds to keep retrying the API call.
 * @param {number} [interval=2000] - The interval in milliseconds between retries.
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
   endpoint: string,
   params: Object,
   validateResult: (result: any) => boolean,
   timeout: number = 30000,
   interval: number = 3000,
 ): Promise<any> => {
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
       onRetry: (error: any) => {
         console.log(`Retrying due to: ${error.message}`);
       },
     },
   );
 };

export const getAccountDetails = async (
  accountId: string,
  timeout: number = 90000,
  interval: number = 3000,
) => {
  return pollWithRetry(
    'accounts',
    { 'account.id': accountId },
    result => result && result.accounts && result.accounts.length > 0,
    timeout,
    interval,
  );
};

export const getTransactionDetails = async (
  transactionId: string,
  timeout: number = 90000,
  interval: number = 3000,
) => {
  const formatedTransactionId = formatTransactionId(transactionId);
  const payerAccountId = transactionId.split('@')[0];

  try {
    return await pollWithRetry(
      `transactions/${formatedTransactionId}`,
      {},
      result => result && result.transactions && result.transactions.length > 0,
      timeout,
      interval,
    );
  } catch (error) {
    console.log(
      `[mirror-node-debug] Exact transaction lookup failed for ${formatedTransactionId}. Fetching transaction lists for comparison.`,
    );
    await logRecentTransactionsForDebug(payerAccountId);

    throw error;
  }
};

export const getAssociatedAccounts = async (
  publicKey: string,
  timeout: number = 90000,
  interval: number = 3000,
) => {
  let allAccounts: string[] = [];
  let params: Object | null = { 'account.publickey': publicKey, order: 'asc' };
  let endpoint = 'accounts';
  const baseURL = getBaseURL();

  do {
    const response: AccountsResponse = await pollWithRetry(
      endpoint,
      params,
      result => result && result.accounts && result.accounts.length > 0,
      timeout,
      interval,
    );

    // Extract the account IDs from the response
    const accounts = response.accounts?.map((account: AccountInfo) => account.account!) ?? [];
    allAccounts = allAccounts.concat(accounts);

    // Check if there is a next link in the response to fetch more data
    if (response.links && response.links.next) {
      const nextLink = response.links.next;

      // Dynamically construct the full URL using the base URL
      const nextUrl = new URL(nextLink, baseURL);
      endpoint = nextUrl.pathname.replace('/api/v1/', ''); // Correctly adjust the endpoint
      params = Object.fromEntries(nextUrl.searchParams.entries()) as Object;
    } else {
      params = null; // Exit loop if there's no next link
    }
  } while (params); // Continue looping if there's more data to fetch

  console.log('Collected all associated accounts:', allAccounts);
  return allAccounts;
};
