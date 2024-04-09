class BasePage {
    constructor(window) {
        this.window = window;
    }

    async clickByTestId(testId) {
        console.log(`Clicking on element with testId: ${testId}`);
        const element = this.window.getByTestId(testId);
        await element.waitFor({state: 'visible', timeout: 1000});
        await element.click();
    }

    async clickByTestIdWithIndex(testId, index = 1) {
        console.log(`Clicking on element with testId: ${testId} at index: ${index}`);
        const element = this.window.getByTestId(testId).nth(index);
        await element.waitFor({state: 'visible', timeout: 1000});
        await element.click();
    }

    async getToastMessageByText(toastText) {
        console.log(`Getting toast message by text: ${toastText}`);
        await this.window.waitForSelector(toastText, {state: 'visible'});
        return this.window.locator(toastText).textContent();
    }

    async getTextByTestId(testId) {
        console.log(`Getting text for element with testId: ${testId}`);
        const element = this.window.getByTestId(testId);
        await element.waitFor({state: 'visible', timeout: 1000});
        return element.textContent();
    }

    async getTextByCssSelector(selector) {
        console.log(`Getting text for element with CSS selector: ${selector}`);
        const element = this.window.locator(selector);
        await element.waitFor({state: 'visible', timeout: 1000});
        return element.textContent();
    }

    async fillByTestId(testId, value) {
        console.log(`Filling element with testId: ${testId} with value: ${value}`);
        const element = this.window.getByTestId(testId);
        await element.fill(value);
    }

    async isElementVisibleAndEditable(testId) {
        console.log(`Checking if element with testId: ${testId} is visible and editable`);
        const element = this.window.getByTestId(testId);
        await element.waitFor({state: 'visible', timeout: 1000});
        const isVisible = await element.isVisible();
        const isEditable = testId.includes('input') ? await element.isEditable() : true;
        return isVisible && isEditable;
    }

    async isElementVisible(testId) {
        console.log(`Checking if element with testId: ${testId} is visible`);
        try {
            const element = this.window.getByTestId(testId);
            await element.waitFor({state: 'visible', timeout: 1000});
            return await element.isVisible();
        } catch (error) {
            return false;
        }
    }

    async isElementEditable(testId) {
        console.log(`Checking if element with testId: ${testId} is editable`);
        const element = this.window.getByTestId(testId);
        await element.waitFor({state: 'visible', timeout: 1000});
        return await element.isEditable();
    }

    async isElementVisibleByIndex(testId, index = 1) {
        console.log(`Checking if element with testId: ${testId} at index: ${index} is visible`);
        try {
            const element = this.window.getByTestId(testId).nth(index);
            await element.waitFor({state: 'visible', timeout: 1000});
            return await element.isVisible();
        } catch (error) {
            return false;
        }
    }

    async waitForElementToDisappear(selector) {
        console.log(`Waiting for element with selector: ${selector} to disappear`);
        try {
            await this.window.waitForSelector(selector, {state: 'attached', timeout: 1000});
            await this.window.waitForSelector(selector, {state: 'detached', timeout: 5500});
        } catch (error) {
            console.error(`Element with selector ${selector} did not disappear.`);
        }
    }

    async scrollIntoViewByTestId(testId) {
        console.log(`Scrolling element with testId: ${testId} into view`);
        const element = this.window.getByTestId(testId);
        await element.scrollIntoViewIfNeeded();
    }

    async isDisabled(testId) {
        console.log(`Checking if element with testId: ${testId} is disabled`);
        const element = await this.window.getByTestId(testId);
        await element.waitFor({state: 'visible', timeout: 1000});
        return await element.isDisabled();
    }
}

module.exports = BasePage;
