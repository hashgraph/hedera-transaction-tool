import listenForKeyPairEvents from './keyPairs';
import listenForLocalUserEvents from './localUser';
import listenForAccountsEvents from './accounts';

export default (app: Electron.App) => {
  listenForKeyPairEvents();
  listenForLocalUserEvents(app);
  listenForAccountsEvents();
};
