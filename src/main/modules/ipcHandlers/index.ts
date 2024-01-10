import listenForThemeEvents from './theme';
import listenForConfigurationEvents from './configuration';
import listenForKeyPairsEvents from './keyPairs';
import listenForUtilsEvents from './utils';
import listenForAccountsEvents from './accounts';

export default function (app: Electron.App) {
  listenForThemeEvents();
  listenForConfigurationEvents();
  listenForUtilsEvents();
  listenForAccountsEvents();
  listenForKeyPairsEvents(app);
}
