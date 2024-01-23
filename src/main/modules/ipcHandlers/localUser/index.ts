import listenForKeyPairEvents from './keyPairs';
import listenForLocalUserEvents from './localUser';
import listenForAccountsEvents from './accounts';
import listenForTransactionsEvents from './transactions';

export default (app: Electron.App) => {
  listenForKeyPairEvents();
  listenForLocalUserEvents(app);
  listenForAccountsEvents();
  listenForTransactionsEvents();
};
