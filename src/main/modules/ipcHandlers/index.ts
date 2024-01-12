import listenForThemeEvents from './theme';
import listenForConfigurationEvents from './configuration';
import listenForUtilsEvents from './utils';
import listenForLocalUserEvents from './localUser';

export default function (app: Electron.App) {
  listenForThemeEvents();
  listenForConfigurationEvents();
  listenForUtilsEvents();
  listenForLocalUserEvents(app);
}
