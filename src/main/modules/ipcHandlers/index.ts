import listenForThemeEvents from './theme';
import listenForConfigurationEvents from './configuration';
import listenForRecoveryPhraseEvents from './recoveryPhrase';
import listenForPrivateKeyEvents from './privateKey';

export default function (app: Electron.App) {
  listenForThemeEvents();
  listenForConfigurationEvents();
  listenForRecoveryPhraseEvents(app);
  listenForPrivateKeyEvents(app);
}
