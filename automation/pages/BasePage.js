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

  /**
   * Waits for an element with a specified testId to become visible within the DOM.
   * @param {string} testId The testId of the element to wait for.
   * @param {number} [timeout=this.LONG_TIMEOUT] Optional timeout to wait for the element to be actionable.
   */
  async waitForElementToBeVisible(testId, timeout = this.LONG_TIMEOUT) {
    console.log(`Waiting for element with testId: ${testId} to become visible`);
    try {
      await this.window.waitForSelector(`[data-testid="${testId}"]`, { state: 'visible', timeout });
      console.log(`Element with testId ${testId} is now visible.`);
    } catch (error) {
      console.error(
        `Element with testId ${testId} did not become visible within the timeout: ${timeout}`,
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
    console.log(`Looking for elements with prefix: ${testIdPrefix}`);
    const elements = this.window.locator(`[data-testid^="${testIdPrefix}"]`);
    const count = await elements.count();
    console.log(`Found ${count} elements with prefix: ${testIdPrefix}`);
    return count;
  }

  /**
   * Toggles a checkbox styled as a switch by targeting the specific input element.
   * This method is designed to avoid confusion when multiple elements share the same data-testid.
   *
   * @param {string} testId The data-testid attribute of the switch to interact with.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] Optional timeout to wait for the element to be actionable.
   */
  async toggleSwitchByTestId(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Toggling switch with testId: ${testId}`);
    const selector = `input[type='checkbox'][data-testid="${testId}"]`; // More specific selector targeting the input
    try {
      await this.window.waitForSelector(selector, { state: 'attached', timeout: timeout });
      await this.window.click(selector, { force: true });
      console.log(`Clicked on switch using force option.`);
    } catch (error) {
      console.error(`Failed to click on the switch using direct method. Error: ${error.message}`);
      // Attempt clicking via JavaScript as a fallback
      await this.window.evaluate(selector => {
        const element = document.querySelector(selector);
        element.click(); // JavaScript click
      }, selector);
      console.log(`Clicked on switch using JavaScript.`);
    }
  }
}

module.exports = BasePage;
