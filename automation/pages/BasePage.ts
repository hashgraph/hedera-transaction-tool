import { Page, Locator } from '@playwright/test';

export class BasePage {
  private readonly DEFAULT_TIMEOUT = 1000*2;
  private readonly LONG_TIMEOUT = 5500;

  constructor(protected readonly window: Page) {}

  // Debug helper - pauses test execution for manual inspection
  async pause() {
    await this.window.pause();
  }

  // --------------------------
  // Helper Methods
  // --------------------------

  /**
   * Helper method to determine if a selector is a CSS selector.
   * @param {string} selector - The selector to check.
   * @returns {boolean} - True if the selector is a CSS selector, false otherwise.
   */
  isCssSelector(selector: string): boolean {
    // Check if the selector starts with '.', '#', '[', or ':'
    const cssSelectorPattern = /^[.#\[:]/;
    return cssSelectorPattern.test(selector);
  }

  /**
   * Unified method to get an element based on the selector type.
   * @param {string} selector - The selector to find the element.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @returns {Locator} - The element handle.
   * @throws {Error} - If the selector is invalid.
   */
  getElement(selector: string, index: number|null = null): Locator {
    let element: Locator;
    if (this.isCssSelector(selector)) {
      element = this.window.locator(selector);
    } else {
      // Treat as data-testid
      element = this.window.getByTestId(selector);
    }

    // Apply .nth(index) only if index is not null
    if (index !== null) {
      element = element.nth(index);
    }

    return element;
  }

  // --------------------------
  // Element Interaction Methods
  // --------------------------

  /**
   * Clicks on an element specified by the selector.
   * @param {string} selector - The selector of the element to click.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<void>}
   */
  async click(selector: string, index: number|null = null, timeout = this.DEFAULT_TIMEOUT): Promise<void> {
    console.log(`Clicking on element with selector: ${selector}`);
    const element = this.getElement(selector, index);
    await element.waitFor({ state: 'visible', timeout });
    await element.click();
  }

  /**
   * Fills an input field with the provided value.
   * @param {string} selector - The selector of the input element.
   * @param {string} value - The value to fill in.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<void>}
   */
  async fill(selector: string, value: string, index: number|null = null, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Filling element with selector: ${selector} with value: ${value}`);
    const element = this.getElement(selector, index);
    await element.waitFor({ state: 'visible', timeout });
    await element.fill(value);
  }

  /**
   * Fills an input field and verifies that the value is correctly filled (ignoring any appended checksum).
   * Retries if necessary.
   * @param {string} selector - The selector of the input element.
   * @param {string} value - The expected account id (without checksum).
   * @param {number} [retries=5] - Number of retries.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<void>}
   * @throws {Error} - If the value cannot be correctly filled after retries.
   */
  async fillAndVerify(selector: string, value: string, retries = 5, index: number|null = null, timeout = this.DEFAULT_TIMEOUT) {
    let attempt = 0;
    let currentValue = '';

    // Helper to check if the current value is valid.
    // It trims the value and checks if it starts with the expected account id.
    const isValueValid = (text: string) => text.trim().startsWith(value);

    while (attempt < retries) {
      console.log(
        `Attempt ${attempt + 1}: Filling element with selector: ${selector} with value: ${value}`,
      );
      await this.fill(selector, value, index, timeout);

      // Verify the value in the input field
      currentValue = await this.getTextFromInputField(selector, index, timeout);
      console.log(
        `Attempt ${attempt + 1}: Verifying element with selector: ${selector}, expected prefix: ${value}, current value: ${currentValue}`,
      );

      if (isValueValid(currentValue)) {
        console.log(
          `Successfully filled element with selector: ${selector} with value (ignoring checksum): ${value} on attempt ${attempt + 1}`,
        );
        return;
      }

      attempt++;
      // Wait for 500 milliseconds before retrying
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // If after all retries the value doesn't start with the expected account id, throw an error.
    throw new Error(
      `Failed to correctly fill element with selector: ${selector} after ${retries} attempts. Expected prefix: ${value}, Found: ${currentValue}`,
    );
  }

  /**
   * Selects an option from a <select> element by its value.
   * @param {string} selector - The selector of the <select> element.
   * @param {string} value - The value of the option to select.
   * @param {number|null} [index=null] - Optional index to select a specific <select> element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<void>}
   */
  async selectOptionByValue(selector: string, value: string, index: number|null = null, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Selecting option with value: ${value} in <select> with selector: ${selector}`);
    const selectElement = this.getElement(selector, index);
    await selectElement.waitFor({ state: 'visible', timeout });
    await selectElement.selectOption({ value });
  }

  /**
   * Toggles a checkbox styled as a switch by targeting the specific input element.
   * @param {string} selector - The data-testid of the switch element.
   * @param {number|null} [index=null] - Optional index to select a specific switch when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be actionable.
   * @returns {Promise<void>}
   */
  async toggleSwitch(selector: string, index: number|null = null, timeout = this.DEFAULT_TIMEOUT) {
    console.log(`Toggling switch with selector: ${selector}`);
    const element = this.getElement(selector, index);
    const inputElement = element.locator('input[type="checkbox"]');
    try {
      await inputElement.waitFor({ state: 'attached', timeout });
      await inputElement.click({ force: true });
      console.log(`Clicked on switch using force option.`);
    } catch (error) {
      console.error(`Failed to click on the switch. Error: ${error}`);
      // Attempt clicking via JavaScript as a fallback
      await this.window.evaluate(el => el.click(), inputElement);
      console.log(`Clicked on switch using JavaScript.`);
    }
  }

  /**
   * Scrolls the element into view.
   * @param {string} selector - The selector of the element to scroll into view.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @returns {Promise<void>}
   */
  async scrollIntoView(selector: string, index: number|null = null) {
    console.log(`Scrolling element with selector: ${selector} into view`);
    const element = this.getElement(selector, index);
    await element.scrollIntoViewIfNeeded();
  }

  /**
   * Waits for an element to disappear from the DOM.
   * @param {string} selector - The selector of the element to wait for.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to appear.
   * @param {number} [longTimeout=this.LONG_TIMEOUT] - Optional timeout to wait for the element to disappear.
   * @returns {Promise<void>}
   */
  async waitForElementToDisappear(
    selector: string,
    timeout = this.DEFAULT_TIMEOUT,
    longTimeout = this.LONG_TIMEOUT,
  ) {
    console.log(`Waiting for element with selector: ${selector} to disappear`);
    try {
      await this.window.waitForSelector(selector, { state: 'attached', timeout: timeout });
      await this.window.waitForSelector(selector, { state: 'detached', timeout: longTimeout });
    } catch {
      console.error(`Element with selector ${selector} did not disappear.`);
    }
  }

  /**
   * Waits for an element with a specified testId to become visible within the DOM.
   * @param {string} testId - The testId of the element to wait for.
   * @param {number} [timeout=this.LONG_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<void>}
   */
  async waitForElementToBeVisible(testId: string, timeout = this.LONG_TIMEOUT) {
    console.log(`Waiting for element with testId: ${testId} to become visible`);
    try {
      await this.window.waitForSelector(`[data-testid="${testId}"]`, { state: 'visible', timeout });
      console.log(`Element with testId ${testId} is now visible.`);
    } catch (error) {
      console.error(
        `Element with testId ${testId} did not become visible within the timeout: ${timeout}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Waits for an element to be present in the DOM.
   * @param {string} testId - The data-testid of the element to wait for.
   * @param {number} [timeout=this.LONG_TIMEOUT] - Optional timeout to wait for the element to be present.
   * @returns {Promise<void>}
   */
  async waitForElementPresentInDOM(testId: string, timeout = this.LONG_TIMEOUT) {
    try {
      await this.window.waitForSelector(`[data-testid="${testId}"]`, {
        state: 'attached',
        timeout: timeout,
      });
      console.log(`Element with selector "${testId}" is present in the DOM.`);
    } catch {
      console.error(
        `Element with selector "${testId}" did not appear in the DOM within ${timeout} ms.`,
      );
    }
  }

  /**
   * Uploads a file via a file input or file chooser dialog.
   * @param {string} selector - The selector of the element to trigger the file upload.
   * @param {string|string[]} filePaths - The path(s) to the file(s) to upload.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @returns {Promise<void>}
   */
  async uploadFile(selector: string, filePaths: string|string[], index: number|null = null) {
    console.log(`Uploading file(s) ${filePaths} via element with selector: ${selector}`);

    const element = this.getElement(selector, index);

    // Determine if the element is an input of type file
    const isInputFile = await element.evaluate(el => el instanceof HTMLInputElement && el.type === 'file');

    if (isInputFile) {
      // If the element is an input[type="file"], set files directly
      await element.setInputFiles(filePaths);
    } else {
      // Otherwise, wait for the file chooser event
      const fileChooserPromise = this.window.waitForEvent('filechooser');
      await element.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(filePaths);
    }
  }

  // --------------------------
  // Element State Methods
  // --------------------------

  /**
   * Checks if an element has the 'active' class.
   * @param {string} selector - The selector of the element to check.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @returns {Promise<boolean>} - True if the element has 'active' class, false otherwise.
   */
  async isElementActive(selector: string, index: number|null = null): Promise<boolean> {
    const element = this.getElement(selector, index);
    const classAttribute = await element.getAttribute('class');
    return classAttribute !== null && classAttribute.includes('active');
  }

  /**
   * Checks if an element is visible.
   * @param {string} selector - The selector of the element to check.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<boolean>} - True if the element is visible, false otherwise.
   */
  async isElementVisible(selector: string, index: number|null = null, timeout = this.DEFAULT_TIMEOUT): Promise<boolean> {
    console.log(`Checking if element with selector: ${selector} is visible`);
    try {
      const element = this.getElement(selector, index);
      await element.waitFor({ state: 'visible', timeout });
      return await element.isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Checks if an element is hidden.
   * @param {string} selector - The selector of the element to check.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be hidden.
   * @returns {Promise<boolean>} - True if the element is hidden, false otherwise.
   */
  async isElementHidden(selector: string, index: number|null = null, timeout = this.DEFAULT_TIMEOUT): Promise<boolean> {
    console.log(`Checking if element with selector: ${selector} is hidden`);
    try {
      const element = this.getElement(selector, index);
      await element.waitFor({ state: 'hidden', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if an element is editable.
   * @param {string} selector - The selector of the element to check.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<boolean>} - True if the element is editable, false otherwise.
   */
  async isElementEditable(selector: string, index: number|null = null, timeout = this.DEFAULT_TIMEOUT): Promise<boolean> {
    console.log(`Checking if element with selector: ${selector} is editable`);
    const element = this.getElement(selector, index);
    await element.waitFor({ state: 'visible', timeout });
    return await element.isEditable();
  }

  /**
   * Checks if an element is disabled.
   * @param {string} selector - The selector of the element to check.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<boolean>} - True if the element is disabled, false otherwise.
   */
  async isDisabled(selector: string, index: number|null = null, timeout = this.DEFAULT_TIMEOUT): Promise<boolean> {
    console.log(`Checking if element with selector: ${selector} is disabled`);
    const element = this.getElement(selector, index);
    await element.waitFor({ state: 'visible', timeout });
    return await element.isDisabled();
  }

  /**
   * Checks if a button is enabled based on its selector.
   * @param {string} testId - The selector for the button to check.
   * @returns {Promise<boolean>} - True if the button is enabled, false otherwise.
   */
  async isButtonEnabled(testId: string): Promise<boolean> {
    const button = await this.window.waitForSelector(`[data-testid="${testId}"]`, {
      state: 'attached',
    });
    return !(await button.isDisabled());
  }

  /**
   * Checks whether the switch with the specified testId is toggled on or off.
   * @param {string} testId - The data-testid of the switch.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be actionable.
   * @returns {Promise<boolean>} - Returns true if the switch is toggled on, false otherwise.
   */
  async isSwitchToggledOn(testId: string, timeout = this.DEFAULT_TIMEOUT): Promise<boolean> {
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
        `Failed to determine the state of the switch with testId: ${testId}. Error: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Checks if the ::before pseudo-element exists and is visible for an element with the specified testId.
   * This method evaluates the computed styles of the ::before pseudo-element to determine its presence.
   * @param {string} testId - The data-testid attribute of the element to check.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<boolean>} - Returns true if the ::before pseudo-element exists and is visible, false otherwise.
   */
  async hasBeforePseudoElement(testId: string, index: number|null = null, timeout = this.DEFAULT_TIMEOUT): Promise<boolean> {
    const element = this.getElement(testId, index);
    await element.waitFor({ state: 'visible', timeout: timeout });

    const pseudoStyles = await element.evaluate(el => {
      const styles = window.getComputedStyle(el, '::before');
      return {
        display: styles.getPropertyValue('display'),
        width: styles.getPropertyValue('width'),
        height: styles.getPropertyValue('height'),
        opacity: styles.getPropertyValue('opacity'),
        visibility: styles.getPropertyValue('visibility'),
        borderLeftWidth: styles.getPropertyValue('border-left-width'),
        borderTopWidth: styles.getPropertyValue('border-top-width'),
      };
    });

    // Check for borders (some indicators use borders instead of width/height)
    const hasBorders =
      parseFloat(pseudoStyles.borderLeftWidth) > 0 ||
      parseFloat(pseudoStyles.borderTopWidth) > 0;

    return (
      pseudoStyles.display !== 'none' &&
      pseudoStyles.visibility !== 'hidden' &&
      parseFloat(pseudoStyles.opacity) !== 0 &&
      (parseFloat(pseudoStyles.width) > 0 || parseFloat(pseudoStyles.height) > 0 || hasBorders)
    );
  }

  // --------------------------
  // Element Content Methods
  // --------------------------

  /**
   * Gets text content of elements.
   * @param {string} selector - The selector of the element(s) to get text from.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<string|null>} - Text content of the element(s).
   */
  async getText(selector: string, index: number|null = null, timeout = this.DEFAULT_TIMEOUT): Promise<string|null> {
    let result: string|null;

    if (index !== null) {
      console.log(`Getting text for element with selector: ${selector} at index ${index}`);
      const element = this.getElement(selector, index);

      try {
        await element.waitFor({ state: 'visible', timeout });
      } catch {
        console.log(
          `Element at index ${index} with selector: ${selector} did not become visible within ${timeout}ms`,
        );
      }

      result = await element.textContent();
    } else {
      console.log(`Getting text for elements with selector: ${selector}`);
      const elements = this.getElement(selector);

      try {
        await elements.first().waitFor({ state: 'visible', timeout });
      } catch {
        console.log(`No elements became visible with selector: ${selector} within ${timeout}ms`);
      }

      const count = await elements.count();

      const texts: string[] = [];
      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        const text = await element.textContent();
        if (text !== null) {
          texts.push(text);
        }
      }

      result = texts.length > 0 ? texts.join(',') : null;
    }

    return Promise.resolve(result);
  }

  /**
   * Gets text from an element, with retry logic.
   * @param {string} selector - The selector of the element to get text from.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @param {number} [retries=5] - Number of retries.
   * @param {number} [retryDelay=1000] - Delay between retries in milliseconds.
   * @returns {Promise<string|null>} - Text content of the element.
   * @throws {Error} - If text cannot be retrieved after retries.
   */
  async getTextWithRetry(
    selector: string,
    index: number|null = null,
    timeout = this.DEFAULT_TIMEOUT,
    retries = 5,
    retryDelay = 1000,
  ): Promise<string|null> {
    console.log(`Getting text for element with selector: ${selector}`);
    let attempt = 0;
    let textContent: string|null = null;

    while (attempt < retries) {
      const element = this.getElement(selector, index);
      await element.waitFor({ state: 'visible', timeout });

      textContent = await element.textContent();
      console.log(
        `Attempt ${attempt + 1}: Retrieved text content: "${textContent}" for element with selector: ${selector}`,
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

    throw new Error(
      `Failed to retrieve text from element with selector: ${selector} after ${retries} attempts`,
    );
  }

  /**
   * Gets text from an input field.
   * @param {string} selector - The selector of the input element.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<string>} - The value of the input field.
   */
  async getTextFromInputField(selector: string, index: number|null = null, timeout = this.DEFAULT_TIMEOUT): Promise<string> {
    console.log(`Getting text from input field with selector: ${selector}`);
    const element = this.getElement(selector, index);
    await element.waitFor({ state: 'visible', timeout });
    return element.inputValue();
  }

  /**
   * Gets text from an input field with retry logic.
   * @param {string} selector - The selector of the input element.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.DEFAULT_TIMEOUT] - Optional timeout to wait for the element to be visible.
   * @returns {Promise<string>} - The value of the input field.
   * @throws {Error} - If a non-empty value cannot be retrieved after retries.
   */
  async getTextFromInputFieldWithRetry(selector: string, index: number|null = null, timeout = this.DEFAULT_TIMEOUT): Promise<string> {
    console.log(`Getting text from input field with selector: ${selector}`);
    const element = this.getElement(selector, index);
    await element.waitFor({ state: 'visible', timeout });

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
      `Failed to retrieve non-empty text from element with selector: ${selector} after multiple attempts`,
    );
  }

  /**
   * Gets the inner text or HTML of an element by its selector.
   * @param {string} selector - The selector of the element.
   * @param {number|null} [index=null] - Optional index to select a specific element when multiple are present.
   * @param {number} [timeout=this.LONG_TIMEOUT] - The timeout to wait for the element to be visible.
   * @returns {Promise<string>} - The inner text or HTML of the element.
   */
  async getInnerContent(selector: string, index: number|null = null, timeout = this.LONG_TIMEOUT): Promise<string> {
    console.log(`Getting inner content for element with selector: ${selector}`);
    const element = this.getElement(selector, index);
    await element.waitFor({ state: 'visible', timeout });
    return element.innerHTML();
  }

  /**
   * Waits for an input field to be filled.
   * @param {string} selector - The selector of the input field.
   * @param {number|null} [index=null] - Optional index to select a specific input field when multiple are present.
   * @param {number} [timeout=this.LONG_TIMEOUT] - Optional timeout to wait for the input field to be filled.
   * @returns {Promise<string>} - The value of the input field once it is filled.
   * @throws {Error} - If the input field is not filled within the timeout period.
   */
  async waitForInputFieldToBeFilled(selector: string, index: number|null = null, timeout = this.LONG_TIMEOUT): Promise<string> {
    console.log(`Waiting for input field with selector: ${selector} to be filled`);
    const element = this.getElement(selector, index);

    const maxAttempts = timeout / 500; // Check every 500ms until the timeout
    let attempts = 0;

    while (attempts < maxAttempts) {
      const tagName = await element.evaluate(node => node.tagName.toLowerCase());
      if (['input', 'textarea', 'select'].includes(tagName)) {
        const value = await element.inputValue();
        if (value.trim() !== '') {
          console.log(`Input field with selector: ${selector} is filled with value: ${value}`);
          return value;
        }
      } else {
        throw new Error(
          `Element with selector: ${selector} is not an input, textarea, or select element`,
        );
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 500 milliseconds before retrying
    }

    throw new Error(
      `Input field with selector: ${selector} was not filled within the timeout period`,
    );
  }

  // --------------------------
  // Utility Methods
  // --------------------------

  /**
   * Counts the number of elements that match a selector prefix.
   * @param {string} selectorPrefix - The prefix of the selector.
   * @returns {Promise<number>} - The count of matching elements.
   */
  async countElements(selectorPrefix: string): Promise<number> {
    console.log(`Looking for elements with prefix: ${selectorPrefix}`);
    const selector = this.isCssSelector(selectorPrefix)
      ? `${selectorPrefix}`
      : `[data-testid^="${selectorPrefix}"]`;
    const elements = this.window.locator(selector);
    const count = await elements.count();
    console.log(`Found ${count} elements with prefix: ${selectorPrefix}`);
    return count;
  }

  /**
   * Closes the 'Save Draft?' modal if it appears during navigation.
   * This modal can block UI interactions when navigating away from unsaved transaction forms.
   * @param {string} [buttonSelector='button-discard-draft-for-group-modal'] - The selector for the discard button.
   * @param {number} [timeout=3000] - Timeout in ms to wait for the modal.
   * @returns {Promise<void>}
   */
  async closeDraftModal(
    buttonSelector = 'button-discard-draft-for-group-modal',
    timeout = 3000,
  ): Promise<void> {
    const modalButton = this.window.getByTestId(buttonSelector);
    await modalButton.waitFor({ state: 'visible', timeout }).catch(() => {});

    if (await modalButton.isVisible()) {
      await modalButton.click();
    }
  }
}
