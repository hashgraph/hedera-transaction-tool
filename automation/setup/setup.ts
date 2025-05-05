// @ts-ignore
import { resetDbState, resetPostgresDbState } from '../utils/databaseUtil';
// @ts-ignore
import { setupApp, closeApp } from '../utils/util';
const SetupPage = require('../pages/SetupPage');

(async () => {
  let app, window;
  let setupPage;

  try {
    // Reset database states
    await resetDbState();
    await resetPostgresDbState();

    // Launch the app
    ({ app, window } = await setupApp());
    setupPage = new SetupPage(window);

    // Perform setup tasks
    await setupPage.createLocalDatabase();
    await setupPage.register();
    await setupPage.fillInMnemonic();
    await setupPage.finishRegistration();
    await setupPage.setupOrganizations();

    console.log('Setup completed successfully.');
  } catch (error) {
    console.error('Error during setup:', error);
  } finally {
    // Close the app
    if (app) {
      await closeApp(app);
    }
  }
})();