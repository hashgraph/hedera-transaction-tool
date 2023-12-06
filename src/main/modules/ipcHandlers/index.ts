import listenForThemeEvents from './theme';
import listenForConfigurationEvents from './configuration';
import listenForRecoveryPhraseEvents from './recoveryPhrase';
import listenForKeyPairsEvents from './keyPairs';

export default function (app: Electron.App) {
  listenForThemeEvents();
  listenForConfigurationEvents();
  listenForRecoveryPhraseEvents();
  listenForKeyPairsEvents(app);
}
