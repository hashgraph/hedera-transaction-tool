import listenForThemeEvents from './theme';
import listenForConfigurationEvents from './configuration';
import listenForKeyPairsEvents from './keyPairs';
import listenForUtilsEvents from './utils';
import listenForAccountsEvents from './accounts';
import listenForLocalUserEvents from './localUser';

export default function (app: Electron.App) {
  listenForThemeEvents();
  listenForConfigurationEvents();
  listenForUtilsEvents();
  listenForAccountsEvents();
  listenForLocalUserEvents();
  listenForKeyPairsEvents(app);
}
