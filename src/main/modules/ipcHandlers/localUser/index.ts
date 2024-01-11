import listenForKeyPairEvents from './keyPairs';
import listenForLocalUserEvents from './localUser';

export default () => {
  listenForKeyPairEvents();
  listenForLocalUserEvents();
};
