import listenForThemeEvents from './theme';
import listenForConfigurationEvents from './configuration';
import listenForKeyPairsEvents from './keyPairs';
import listenForUtilsEvents from './utils';

export default function (app: Electron.App) {
  listenForThemeEvents();
  listenForConfigurationEvents();
  listenForUtilsEvents();
  listenForKeyPairsEvents(app);
}
