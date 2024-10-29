import listenForThemeEvents from './theme';
import listenForUtilsEvents from './utils';
import listenForLocalUserEvents from './localUser';
import listenForUpdateEvents from './update';

export default function () {
  listenForThemeEvents();
  listenForUtilsEvents();
  listenForLocalUserEvents();
  listenForUpdateEvents();
}
