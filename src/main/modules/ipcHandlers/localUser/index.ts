import listenForKeyPairEvents from './keyPairs';
import listenForLocalUserEvents from './localUser';
import listenForAccountsEvents from './accounts';
import listenForTransactionsEvents from './transactions';
import listenForFilesEvents from './files';

export default () => {
  listenForKeyPairEvents();
  listenForLocalUserEvents();
  listenForAccountsEvents();
  listenForTransactionsEvents();
  listenForFilesEvents();
};
