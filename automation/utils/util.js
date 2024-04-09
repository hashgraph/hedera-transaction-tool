const { expect } = require('@playwright/test');
const { launchHederaTransactionTool } = require('./electronAppLauncher');
const LoginPage = require('../pages/LoginPage.js');

async function setupApp() {
    const app = await launchHederaTransactionTool();
    const window = await app.firstWindow();
    const loginPage = new LoginPage(window);
    expect(window).not.toBeNull();
    await loginPage.closeImportantNoteModal();
    return { app, window };
}

async function resetAppState(window) {
    const loginPage = new LoginPage(window);
    await loginPage.resetState();
}

async function closeApp(app) {
    await app.close();
}

const generateRandomEmail = (domain = 'test.com') => {
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `${randomPart}@${domain}`;
};

const generateRandomPassword = (length = 10) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};

module.exports = {
    setupApp,
    resetAppState,
    closeApp,
    generateRandomEmail,
    generateRandomPassword
};
