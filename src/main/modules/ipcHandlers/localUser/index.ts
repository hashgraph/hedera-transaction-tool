import listenForKeyPairEvents from './keyPairs';
import listenForLocalUserEvents from './localUser';
import listenForAccountsEvents from './accounts';
import listenForTransactionsEvents from './transactions';
import listenForFilesEvents from './files';
import listenForTransactionDraftsEvents from './transactionDrafts';

export default () => {
  listenForKeyPairEvents();
  listenForLocalUserEvents();
  listenForAccountsEvents();
  listenForTransactionsEvents();
  listenForFilesEvents();
  listenForTransactionDraftsEvents();
};
