class BasePage {
  DEFAULT_TIMEOUT = 1000;
  LONG_TIMEOUT = 5500;

  constructor(window) {
    this.window = window;
  }

  async clickByTestId(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Clicking on element with testId: ${testId}`);
    const element = this.window.getByTestId(testId);
    await element.waitFor({ state: 'visible', timeout: timeout });
    await element.click();
  }

  async clickByTestIdWithIndex(testId, index = 1, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Clicking on element with testId: ${testId} at index: ${index}`);
    const element = this.window.getByTestId(testId).nth(index);
    await element.waitFor({ state: 'visible', timeout: timeout });
    await element.click();
  }

  async getToastMessageByText(toastText) {
    console.log(`Getting toast message by text: ${toastText}`);
    await this.window.waitForSelector(toastText, { state: 'visible' });
    return this.window.locator(toastText).textContent();
  }

  async getTextByTestId(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Getting text for element with testId: ${testId}`);
    const element = this.window.getByTestId(testId);
    await element.waitFor({ state: 'visible', timeout: timeout });
    return element.textContent();
  }

  async getTextFromInputFieldByTestId(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Getting text for element with testId: ${testId}`);
    const element = this.window.getByTestId(testId);
    await element.waitFor({ state: 'visible', timeout: timeout });
    return element.inputValue();
  }

  async getTextByCssSelector(selector, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Getting text for element with CSS selector: ${selector}`);
    const element = this.window.locator(selector);
    await element.waitFor({ state: 'visible', timeout: timeout });
    return element.textContent();
  }

  async fillByTestId(testId, value) {
    console.log(`Filling element with testId: ${testId} with value: ${value}`);
    const element = this.window.getByTestId(testId);
    await element.fill(value);
  }

  async isElementVisibleAndEditable(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Checking if element with testId: ${testId} is visible and editable`);
    const element = this.window.getByTestId(testId);
    await element.waitFor({ state: 'visible', timeout: timeout });
    const isVisible = await element.isVisible();
    const isEditable = testId.includes('input') ? await element.isEditable() : true;
    return isVisible && isEditable;
  }

  async isElementVisible(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Checking if element with testId: ${testId} is visible`);
    try {
      const element = this.window.getByTestId(testId);
      await element.waitFor({ state: 'visible', timeout: timeout });
      return await element.isVisible();
    } catch (error) {
      return false;
    }
  }

  async isElementEditable(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Checking if element with testId: ${testId} is editable`);
    const element = this.window.getByTestId(testId);
    await element.waitFor({ state: 'visible', timeout: timeout });
    return await element.isEditable();
  }

  async isElementVisibleByIndex(testId, index = 1, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Checking if element with testId: ${testId} at index: ${index} is visible`);
    try {
      const element = this.window.getByTestId(testId).nth(index);
      await element.waitFor({ state: 'visible', timeout: timeout });
      return await element.isVisible();
    } catch (error) {
      return false;
    }
  }

  async waitForElementToDisappear(
    selector,
    timeout = this.DEFAULT_TIMEOUT,
    longTimeout = this.LONG_TIMEOUT,
  ) {
    console.log(`Waiting for element with selector: ${selector} to disappear`);
    try {
      await this.window.waitForSelector(selector, { state: 'attached', timeout: timeout });
      await this.window.waitForSelector(selector, { state: 'detached', timeout: longTimeout });
    } catch (error) {
      console.error(`Element with selector ${selector} did not disappear.`);
    }
  }

  async waitForElementToBeVisible(selector, timeout = this.LONG_TIMEOUT) {
    console.log(`Waiting for element with selector: ${selector} to become visible`);
    try {
      await this.window.waitForFunction(
        sel => {
          const element = document.querySelector(sel);
          return element && getComputedStyle(element).display === 'block';
        },
        `[data-testid="${selector}"]`,
        { timeout: timeout },
      );
      console.log(`Element with selector ${selector} is now visible.`);
    } catch (error) {
      console.error(
        `Element with selector ${selector} did not become visible within the timeout: ${timeout}`,
        error,
      );
    }
  }

  async scrollIntoViewByTestId(testId) {
    console.log(`Scrolling element with testId: ${testId} into view`);
    const element = this.window.getByTestId(testId);
    await element.scrollIntoViewIfNeeded();
  }

  async isDisabled(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Checking if element with testId: ${testId} is disabled`);
    const element = await this.window.getByTestId(testId);
    await element.waitFor({ state: 'visible', timeout: timeout });
    return await element.isDisabled();
  }

  async countElementsByTestId(testIdPrefix) {
    return await this.window.locator(`[data-testid^="${testIdPrefix}"]`).count();
  }
}

module.exports = BasePage;
