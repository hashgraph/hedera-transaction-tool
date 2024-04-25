import listenForThemeEvents from './theme';
import listenForUtilsEvents from './utils';
import listenForLocalUserEvents from './localUser';

export default function () {
  listenForThemeEvents();
  listenForUtilsEvents();
  listenForLocalUserEvents();
}
