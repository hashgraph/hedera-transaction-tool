class BasePage {
  DEFAULT_TIMEOUT = 1000;
  LONG_TIMEOUT = 5500;

  constructor(window) {
    this.window = window;
  }

  async clickByTestId(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Clicking on element with testId: ${testId}`);
    const element = this.window.getByTestId(testId);
    try {
      await element.waitFor({ state: 'visible', timeout: timeout });
    } catch (error) {
      console.log(`Element with testId: ${testId} is not visible`);
    }
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

  async getTextByTestIdWithIndex(testId, index = 1, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Getting text for element with testId: ${testId} at index: ${index}`);
    const element = this.window.getByTestId(testId).nth(index);
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

  async getTextByTestIdWithRetry(
    testId,
    timeout = this.DEFAULT_TIMEOUT,
    retries = 5,
    retryDelay = 1000,
  ) {
    console.log(`Getting text for element with testId: ${testId}`);
    let attempt = 0;
    let textContent = '';

    while (attempt < retries) {
      const element = this.window.getByTestId(testId);
      await element.waitFor({ state: 'visible', timeout: timeout });

      textContent = await element.textContent();
      console.log(
        `Attempt ${attempt + 1}: Retrieved text content: "${textContent}" for element with testId: ${testId}`,
      );

      if (textContent && textContent.trim() !== '') {
        return textContent;
      }

      // Increment the attempt counter and delay before retrying
      attempt++;
      if (attempt < retries) {
        console.log(`Text content is empty or invalid, retrying after ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
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

  async fillAndVerifyByTestId(testId, value, retries = 5) {
    let attempt = 0;
    let currentValue = '';

    while (attempt < retries) {
      // Fill the input field with the provided value
      console.log(
        `Attempt ${attempt + 1}: Filling element with testId: ${testId} with value: ${value}`,
      );
      await this.fillByTestId(testId, value);

      // Verify the value in the input field
      currentValue = await this.getTextFromInputFieldByTestId(testId);
      console.log(
        `Attempt ${attempt + 1}: Verifying element with testId: ${testId}, expected value: ${value}, current value: ${currentValue}`,
      );

      if (currentValue === value) {
        // Value is correct, break out of the loop
        console.log(
          `Successfully filled element with testId: ${testId} with value: ${value} on attempt ${attempt + 1}`,
        );
        break;
      }

      // Increment the attempt counter
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 500 milliseconds before retrying
    }

    if (currentValue !== value) {
      throw new Error(
        `Failed to correctly fill element with testId: ${testId} after ${retries} attempts. Expected: ${value}, Found: ${currentValue}`,
      );
    }
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

  async waitForInputFieldToBeFilled(testId, index = 0, timeout = this.LONG_TIMEOUT) {
    console.log(`Waiting for input field with testId: ${testId} to be filled`);
    const element = this.window.getByTestId(testId).nth(index);

    const maxAttempts = timeout / 500; // Check every 500ms until the timeout
    let attempts = 0;

    while (attempts < maxAttempts) {
      const tagName = await element.evaluate(node => node.tagName.toLowerCase());
      if (['input', 'textarea', 'select'].includes(tagName)) {
        const value = await element.inputValue();
        if (value.trim() !== '') {
          console.log(`Input field with testId: ${testId} is filled with value: ${value}`);
          return value;
        }
      } else {
        throw new Error(
          `Element with testId: ${testId} is not an input, textarea, or select element`,
        );
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 500 milliseconds before retrying
    }

    throw new Error(`Input field with testId: ${testId} was not filled within the timeout period`);
  }

  /**
   * Selects an option from a <select> element by its value.
   *
   * @param {string} testId - The data-testid attribute of the <select> element.
   * @param {string} value - The value of the option to select.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be actionable.
   */
  async selectOptionByValue(testId, value, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Selecting option with value: ${value} in <select> with testId: ${testId}`);
    const selectElement = this.window.getByTestId(testId);
    await selectElement.waitFor({ state: 'visible', timeout: timeout });
    await selectElement.selectOption({ value });
  }

  /**
   * Gets the inner text or HTML of an element by its CSS selector.
   *
   * @param {string} selector - The CSS selector of the element.
   * @param {number} [timeout=this.LONG_TIMEOUT] - The timeout to wait for the element to be visible.
   * @returns {Promise<string>} - The inner text or HTML of the element.
   */
  async getInnerContentBySelector(selector, timeout = this.LONG_TIMEOUT) {
    console.log(`Getting inner content for element with selector: ${selector}`);
    const element = this.window.getByTestId(selector);
    await element.waitFor({ state: 'visible', timeout: timeout });
    return element.innerHTML();
  }

  /**
   * Checks if the ::before pseudo-element exists and is visible for an element with the specified testId.
   * This method evaluates the computed styles of the ::before pseudo-element to determine its presence.
   *
   * @param {string} testId - The data-testid attribute of the element to check.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<boolean>} - Returns true if the ::before pseudo-element exists and is visible, false otherwise.
   */
  async hasBeforePseudoElement(testId, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Checking if ::before pseudo-element exists for element with testId: ${testId}`);
    const element = this.window.getByTestId(testId);
    await element.waitFor({ state: 'visible', timeout: timeout });

    const pseudoStyles = await element.evaluate(el => {
      const styles = window.getComputedStyle(el, '::before');
      return {
        display: styles.getPropertyValue('display'),
        width: styles.getPropertyValue('width'),
        height: styles.getPropertyValue('height'),
        opacity: styles.getPropertyValue('opacity'),
        visibility: styles.getPropertyValue('visibility'),
      };
    });

    return (
      pseudoStyles.display !== 'none' &&
      pseudoStyles.visibility !== 'hidden' &&
      parseFloat(pseudoStyles.opacity) !== 0 &&
      parseFloat(pseudoStyles.width) > 0 &&
      parseFloat(pseudoStyles.height) > 0
    );
  }
}

module.exports = BasePage;
