const BasePage = require('./BasePage');
const {
  getAllPublicKeysByEmail,
  verifyUserExistsInOrganization,
  isUserDeleted,
  upgradeUserToAdmin,
} = require('../utils/databaseQueries');
const { getAssociatedAccounts } = require('../utils/mirrorNodeAPI');

class ContactListPage extends BasePage {
  constructor(window) {
    super(window);
  }

  /* Selectors */

  // Buttons
  removeContactButtonSelector = 'button-remove-account-from-contact-list';
  addNewContactButtonSelector = 'button-add-new-contact';
  changeContactNicknameButtonSelector = 'span-change-nickname';
  registerNewUserButtonSelector = 'button-register-user';
  confirmRemovingContactButtonSelector = 'button-confirm-remove-contact';

  // Inputs
  inputChangeNicknameSelector = 'input-change-nickname';
  newUserEmailInputSelector = 'input-new-user-email';

  // Texts
  contactListEmailSelector = 'p-contact-email';

  // Indexes
  contactEmailIndexSelector = 'p-contact-email-';
  contactListPublicKeyIndexSelector = 'p-contact-public-key-';
  contactListExpandAssociatedAccountsButtonSelector = 'span-expand-associated-accounts-';
  contactListAssociatedAccountIdIndexSelector = 'p-associated-account-id-';
  contactListNicknameIndexSelector = 'p-contact-nickname-';

  async clickOnAccountInContactListByEmail(email) {
    await this.click(this.contactEmailIndexSelector + email);
  }

  async isRemoveContactButtonVisible() {
    return await this.isElementVisible(this.removeContactButtonSelector);
  }

  async isAddNewContactButtonVisible() {
    return await this.isElementVisible(this.addNewContactButtonSelector);
  }

  async isAddNewContactButtonEnabled() {
    return await this.isButtonEnabled(this.addNewContactButtonSelector);
  }

  async getContactListEmailText() {
    return await this.getText(this.contactListEmailSelector);
  }

  async isExpandAssociatedAccountsButtonVisible(index) {
    return await this.isElementVisible(
      this.contactListExpandAssociatedAccountsButtonSelector + index,
      10000,
    );
  }

  async clickOnExpandAssociatedAccountsButton(index) {
    await this.click(this.contactListExpandAssociatedAccountsButtonSelector + index);
  }

  async clickOnChangeNicknameButton() {
    await this.click(this.changeContactNicknameButtonSelector);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async fillInContactNickname(nickname) {
    await this.fill(this.inputChangeNicknameSelector, nickname);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async getContactNicknameText(nickname) {
    return await this.getText(this.contactListNicknameIndexSelector + nickname);
  }

  async clickOnAddNewContactButton() {
    await this.click(this.addNewContactButtonSelector);
  }

  async inputNewUserEmail(email) {
    await this.fill(this.newUserEmailInputSelector, email);
  }

  async clickOnRegisterNewUserButton() {
    await this.click(this.registerNewUserButtonSelector);
  }

  async clickOnRemoveContactButton() {
    await this.click(this.removeContactButtonSelector);
  }

  async clickOnConfirmRemoveContactButton() {
    await this.click(this.confirmRemovingContactButtonSelector);
  }

  async upgradeUserToAdmin(email) {
    return await upgradeUserToAdmin(email);
  }

  async addNewUser(email) {
    await this.clickOnAddNewContactButton();
    await this.inputNewUserEmail(email);
    await this.clickOnRegisterNewUserButton();
  }

  // This method will compare the public keys from the contact list with the public keys from the database.
  async comparePublicKeys(email) {
    const pagePublicKeys = await this.getAllPublicKeysFromContactList();
    const dbPublicKeys = await getAllPublicKeysByEmail(email);
    const sortedPageKeys = pagePublicKeys.sort();
    const sortedDbKeys = dbPublicKeys.sort();

    return (
      sortedPageKeys.length === sortedDbKeys.length &&
      sortedPageKeys.every((value, index) => value === sortedDbKeys[index])
    );
  }

  async getAllPublicKeysFromContactList() {
    const publicKeys = [];
    const count = await this.countElements(this.contactListPublicKeyIndexSelector);
    for (let i = 0; i < count; i++) {
      publicKeys.push(await this.getText(this.contactListPublicKeyIndexSelector + i));
    }
    return publicKeys;
  }

  /**
   * Verifies that the associated accounts displayed in the UI match the associated accounts from Mirror node.
   * @returns {Promise<boolean>} True if the associated accounts match, false otherwise.
   */
  async verifyAssociatedAccounts() {
    const associatedAccounts = await this.getAssociatedAccounts();

    for (const publicKey in associatedAccounts) {
      if (associatedAccounts.hasOwnProperty(publicKey)) {
        const expectedAccounts = await this.mirrorGetAssociatedAccounts(publicKey);
        const areAccountsCorrect = this.compareAccountLists(
          associatedAccounts[publicKey],
          expectedAccounts,
        );

        if (!areAccountsCorrect) {
          const missingFromUI = expectedAccounts.filter(
            id => !associatedAccounts[publicKey].includes(id),
          );
          const missingFromMirror = associatedAccounts[publicKey].filter(
            id => !expectedAccounts.includes(id),
          );

          console.error(`Discrepancy found for public key: ${publicKey}`);
          console.error(`Missing from UI: ${missingFromUI}`);
          console.error(`Missing from Mirror Node: ${missingFromMirror}`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Retrieves all associated accounts for the second public key listed in the contact list.
   *
   * This method will specifically check if there is an expandable section
   * for associated accounts for the second public key, and if present,
   * it will click to expand and collect all associated accounts.
   *
   * @returns {Promise<Object<string, string[]>>} A map where the key is the second public key from the contact list,
   * and the value is an array of associated account IDs. If no associated accounts are found, an empty object is returned.
   *
   * Example return structure:
   * {
   *   "99b6b48d00038a65d9342b37dea634d189de09a0ce68212401515bbc9dc93248": [
   *     "0.0.1029"
   *   ]
   * }
   */
  async getAssociatedAccounts() {
    const publicKeys = await this.getAllPublicKeysFromContactList();
    const associatedAccountsMap = {};

    // Focus only on the second public key (index 1)
    const secondPublicKeyIndex = 1;

    if (await this.isExpandAssociatedAccountsButtonVisible(secondPublicKeyIndex)) {
      await this.clickOnExpandAssociatedAccountsButton(secondPublicKeyIndex);

      const associatedAccounts = [];
      let index = 0;

      while (true) {
        const associatedAccountSelector =
          this.contactListAssociatedAccountIdIndexSelector + secondPublicKeyIndex + '-' + index;
        const isAccountVisible = await this.isElementVisible(associatedAccountSelector);

        if (!isAccountVisible) {
          break;
        }

        const account = await this.getText(associatedAccountSelector);
        associatedAccounts.push(account.trim());
        index++;
      }

      if (associatedAccounts.length > 0) {
        associatedAccountsMap[publicKeys[secondPublicKeyIndex]] = associatedAccounts;
      }
    }

    return associatedAccountsMap;
  }

  // This method will get the associated accounts from the Mirror node.
  async mirrorGetAssociatedAccounts(publicKey) {
    const accountIds = await getAssociatedAccounts(publicKey);

    if (accountIds.length > 0) {
      console.log('Associated accounts:', accountIds);
    } else {
      console.log('No associated accounts found');
    }

    return accountIds;
  }

  // This method will compare two arrays of account IDs.
  compareAccountLists(array1, array2) {
    const sortedArray1 = array1.map(id => id.trim()).sort();
    const sortedArray2 = array2.map(id => id.trim()).sort();

    if (sortedArray1.length !== sortedArray2.length) {
      return false;
    }

    for (let i = 0; i < sortedArray1.length; i++) {
      if (sortedArray1[i] !== sortedArray2[i]) {
        return false;
      }
    }

    return true;
  }

  async verifyUserExistsInOrganization(email) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return await verifyUserExistsInOrganization(email);
  }

  async isUserDeleted(email) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return await isUserDeleted(email);
  }
}

module.exports = ContactListPage;
