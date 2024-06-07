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

  async getAllTextByTestId(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Getting text for element with testId: ${testId}`);

    const elements = this.window.locator(`[data-testid="${testId}"]`);

    const count = await elements.count();
    if (count !== 2) {
      throw new Error(`Expected exactly 2 elements but found ${count}`);
    }

    const texts = [];
    for (let i = 0; i < count; i++) {
      const element = elements.nth(i);
      await element.waitFor({ state: 'visible', timeout: timeout });
      texts.push(await element.textContent());
    }

    return texts;
  }

  async getTextFromInputFieldByTestId(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Getting text for element with testId: ${testId}`);
    const element = this.window.getByTestId(testId);
    await element.waitFor({ state: 'visible', timeout: timeout });
    return element.inputValue();
  }

  async getTextFromInputFieldByTestIdWithIndex(testId, index = 1, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Getting text for element with testId: ${testId}`);
    const element = this.window.getByTestId(testId).nth(index);
    await element.waitFor({ state: 'visible', timeout: timeout });

    const maxAttempts = 10;
    const interval = 500;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const value = await element.inputValue();
      if (value.trim() !== '') {
        return value;
      }

      attempts++;
      console.log(`Attempt ${attempts}: Input field is still empty, waiting...`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(
      `Failed to retrieve non-empty text from element with testId: ${testId} after multiple attempts`,
    );
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

  async fillByTestIdWithIndex(testId, value, index = 1) {
    console.log(`Filling element with testId: ${testId} with value: ${value}`);
    const element = this.window.getByTestId(testId).nth(1);
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

  /**
   * Checks if a button is enabled based on its selector.
   * @param {string} testId - The selector for the button to check.
   * @returns {Promise<boolean>} - True if the button is enabled, false otherwise.
   */
  async isButtonEnabled(testId) {
    const button = await this.window.waitForSelector(`[data-testid="${testId}"]`, {
      state: 'attached',
    });
    return !(await button.isDisabled());
  }

  async waitForElementPresentInDOM(testId, timeout = this.LONG_TIMEOUT) {
    try {
      await this.window.waitForSelector(`[data-testid="${testId}"]`, {
        state: 'attached',
        timeout: timeout,
      });
      console.log(`Element with selector "${testId}" is present in the DOM.`);
    } catch (error) {
      console.error(
        `Element with selector "${testId}" did not appear in the DOM within ${timeout} ms.`,
      );
      throw error;
    }
  }

  /**
   * Checks whether the switch with the specified testId is toggled on or off.
   * @param {string} testId - The data-testid of the switch.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be actionable.
   * @returns {Promise<boolean>} - Returns true if the switch is toggled on, false otherwise.
   */
  async isSwitchToggledOn(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Checking if switch with testId: ${testId} is toggled on`);
    const selector = `input[type='checkbox'][data-testid="${testId}"]`;
    try {
      const element = await this.window.waitForSelector(selector, {
        state: 'attached',
        timeout: timeout,
      });
      const isChecked = await element.isChecked();
      console.log(`Switch with testId: ${testId} is toggled ${isChecked ? 'on' : 'off'}`);
      return isChecked;
    } catch (error) {
      console.error(
        `Failed to determine the state of the switch with testId: ${testId}. Error: ${error.message}`,
      );
      throw error;
    }
  }
}

module.exports = BasePage;
