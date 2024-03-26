import listenForThemeEvents from './theme';
import listenForUtilsEvents from './utils';
import listenForLocalUserEvents from './localUser';
import listenForRemoteOrganizationEvents from './organization';

export default function () {
  listenForThemeEvents();
  listenForUtilsEvents();
  listenForLocalUserEvents();
  listenForRemoteOrganizationEvents();
}
