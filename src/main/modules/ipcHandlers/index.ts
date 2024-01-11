import listenForThemeEvents from './theme';
import listenForConfigurationEvents from './configuration';
import listenForUtilsEvents from './utils';
import listenForAccountsEvents from './accounts';
import listenForLocalUserEvents from './localUser';

export default function () {
  listenForThemeEvents();
  listenForConfigurationEvents();
  listenForUtilsEvents();
  listenForAccountsEvents();
  listenForLocalUserEvents();
}
