const { test } = require('@playwright/test');
const { setupApp, closeApp } = require('../utils/util');
const SetupPage = require('../pages/SetupPage');
const { resetDbState, resetPostgresDbState } = require('../utils/databaseUtil');

let app, window;
let setupPage;

test('Reset app for development', async () => {
  await resetDbState();
  await resetPostgresDbState();
  ({ app, window } = await setupApp());
  setupPage = new SetupPage(window);

  await setupPage.createLocalDatabase();

  await setupPage.register();

  await setupPage.fillInMnemonic();
  await setupPage.finishRegistration();

  await setupPage.setupOrganizations();

  await closeApp(app);
});