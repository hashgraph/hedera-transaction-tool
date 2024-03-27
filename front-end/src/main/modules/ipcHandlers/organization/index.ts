import listenForUserEvents from './user';
import listenForUserKeysEvents from './userKeys';

export default () => {
  listenForUserEvents();
  listenForUserKeysEvents();
};
