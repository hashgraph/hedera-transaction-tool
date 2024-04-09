const BasePage = require("./BasePage");

class LoginPage extends BasePage{
    constructor(window) {
        super(window);
        this.window = window;
    }

    // Selectors
    emailInputSelector = 'input-email';
    passwordInputSelector = 'input-password';
    signInButtonSelector = 'button-login';
    importantNoteModalButton = 'button-understand-agree';
    resetStateButtonSelector = 'link-reset';
    confirmResetStateButtonSelector = 'button-reset';
    toastMessageSelector = '.v-toast__text';


    // Method to close the 'Important note' modal if it appears
    async closeImportantNoteModal() {
        // Wait for the button to be visible with a timeout
        const modalButton = this.window.getByTestId(this.importantNoteModalButton);
        await modalButton.waitFor({ state: 'visible', timeout: 500  }).catch(e => {
        });

        // If the modal is visible, then click the button to close the modal
        if (await modalButton.isVisible()) {
            await modalButton.click();
        }
    }


    // Method to fill in the email
    async typeEmail(email) {
        await this.window.getByTestId(this.emailInputSelector).fill(email);
    }

    // Method to fill in the password
    async typePassword(password) {
        await this.window.getByTestId(this.passwordInputSelector).fill(password);
    }

    // Method to click the sign in button
    async clickSignIn() {
        await this.window.getByTestId(this.signInButtonSelector).click();
    }

    async waitForToastToDisappear(){
        await this.waitForElementToDisappear(this.toastMessageSelector);
    }

    // Combined method to log in
    async login(email, password) {
        await this.typeEmail(email);
        await this.typePassword(password);
        await this.clickSignIn();
    }

    // Method to reset the application state
    async resetState() {
        // Check if the initial reset button exists and is visible
        const initialResetButtonExists = await this.window.getByTestId(this.resetStateButtonSelector).isVisible();

        // Proceed only if the initial reset button is visible
        if (initialResetButtonExists) {
            await this.window.getByTestId(this.resetStateButtonSelector).click();

            // Now wait for the confirmation reset button to become visible
            try {
                const resetButton = this.window.getByTestId(this.confirmResetStateButtonSelector);
                await resetButton.waitFor({ state: 'visible', timeout: 1000 });
                // If the waitFor resolves successfully, click the reset button
                await resetButton.click();
                await this.waitForToastToDisappear();
            } catch (e) {
                // If the waitFor throws an error (e.g., timeout), log the error
                console.log("The 'Reset' modal did not appear within the timeout.");
            }
        }
    }
}

module.exports = LoginPage;
