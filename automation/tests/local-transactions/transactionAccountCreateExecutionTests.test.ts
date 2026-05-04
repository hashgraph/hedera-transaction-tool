import { expect, test } from '@playwright/test';
import { setupLocalTransactionSuite } from '../helpers/fixtures/localTransactionSuite.js';

test.describe('Transaction account create execution tests', () => {
  const suite = setupLocalTransactionSuite();

  test('Verify user can execute Account Create tx with complex key', async () => {
    const transactionPage = suite.transactionPage;
    const { newAccountId } = await transactionPage.createNewAccount({ isComplex: true });
    const allGeneratedKeys = transactionPage.getAllGeneratedPublicKeys();

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const protoBufEncodedBytes = accountDetails.accounts[0]?.key?.key;
    const decodedKeys = await transactionPage.decodeByteCode(protoBufEncodedBytes);
    const keysMatch = await transactionPage.keysMatch(decodedKeys, allGeneratedKeys);
    expect(keysMatch).toBe(true);
  });

  test('Verify user can execute create account transaction with single key', async () => {
    const transactionPage = suite.transactionPage;
    const { newAccountId } = await transactionPage.createNewAccount();
    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const createdTimestamp = accountDetails.accounts[0]?.created_timestamp;
    expect(createdTimestamp).toBeTruthy();
  });

  test('Verify user can create account with memo', async () => {
    const transactionPage = suite.transactionPage;
    const memoText = 'test memo';
    const { newAccountId } = await transactionPage.createNewAccount({ memo: memoText });
    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const memoFromAPI = accountDetails.accounts[0]?.memo;
    expect(memoFromAPI).toBe(memoText);
  });

  test('Verify user can create account with receiver sig required', async () => {
    const transactionPage = suite.transactionPage;
    const { newAccountId } = await transactionPage.createNewAccount({
      isReceiverSigRequired: true,
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const isReceiverSigRequired = accountDetails.accounts[0]?.receiver_sig_required;
    expect(isReceiverSigRequired).toBe(true);
  });

  test('Verify user can create account with initial funds', async () => {
    const transactionPage = suite.transactionPage;
    const initialHbarFunds = 1;

    const { newAccountId } = await transactionPage.createNewAccount({
      initialFunds: initialHbarFunds.toString(),
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const balanceFromAPI = accountDetails.accounts[0]?.balance?.balance;
    expect(balanceFromAPI).toBe(initialHbarFunds * 100000000);
  });

  test('Verify user can create account with max account associations', async () => {
    const transactionPage = suite.transactionPage;
    const maxAutoAssociations = 10;
    const { newAccountId } = await transactionPage.createNewAccount({ maxAutoAssociations });
    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const maxAutoAssociationsFromAPI =
      accountDetails.accounts[0]?.max_automatic_token_associations;
    expect(maxAutoAssociationsFromAPI).toBe(maxAutoAssociations);
  });
});
