import listenForKeyPairEvents from './keyPairs';
import listenForLocalUserEvents from './localUser';
import listenForAccountsEvents from './accounts';

export default () => {
  listenForKeyPairEvents();
  listenForLocalUserEvents();
  listenForAccountsEvents();
};
