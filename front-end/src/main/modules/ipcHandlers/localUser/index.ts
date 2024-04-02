import listenForKeyPairEvents from './keyPairs';
import listenForLocalUserEvents from './localUser';
import listenForAccountsEvents from './accounts';
import listenForTransactionsEvents from './transactions';
import listenForFilesEvents from './files';
import listenForTransactionDraftsEvents from './transactionDrafts';
import listenForComplexKeyEvents from './complexKeys';
import listenForOrganizationEvents from './organizations';
import listenForOrganizationCredentialsEvents from './organizationCredentials';

export default () => {
  listenForKeyPairEvents();
  listenForLocalUserEvents();
  listenForAccountsEvents();
  listenForTransactionsEvents();
  listenForFilesEvents();
  listenForTransactionDraftsEvents();
  listenForComplexKeyEvents();
  listenForOrganizationEvents();
  listenForOrganizationCredentialsEvents();
};
