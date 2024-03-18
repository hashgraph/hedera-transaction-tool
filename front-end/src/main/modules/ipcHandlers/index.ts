import listenForThemeEvents from './theme';
import listenForConfigurationEvents from './configuration';
import listenForUtilsEvents from './utils';
import listenForLocalUserEvents from './localUser';

export default function () {
  listenForThemeEvents();
  listenForConfigurationEvents();
  listenForUtilsEvents();
  listenForLocalUserEvents();
}
