import { Page } from '@playwright/test';
import { BasePage } from './BasePage.js';
import { queryDatabase } from '../utils/databaseUtil.js';

export class SettingsPage extends BasePage {
  constructor(window: Page, public currentIndex = "1") {
    super(window);
  }

  /* Selectors */

  // Inputs
  indexInputSelector = 'input-index';
  nicknameInputSelector = 'input-nickname';
  ed25519PrivateKeyInputSelector = 'input-ed25519-private-key';
  ed25519PNicknameInputSelector = 'input-ed25519-private-key-nickname';
  ecdsaPrivateKeyInputSelector = 'input-ecdsa-private-key';
  ecdsaNicknameInputSelector = 'input-ecdsa-private-key-nickname';
  currentPasswordInputSelector = 'input-current-password';
  newPasswordInputSelector = 'input-new-password';
  defaultMaxTransactionFeeInputSelector = 'input-default-max-transaction-fee';
  keyPairNicknameInputSelector = 'input-key-pair-nickname';
  mirrorNodeBaseURLInputSelector = 'input-mirror-node-base-url';

  // Buttons
  settingsButtonSelector = 'button-menu-settings';
  generalTabButtonSelector = 'tab-0';
  organisationsTabButtonSelector = 'tab-1';
  keysTabButtonSelector = 'tab-2';
  profileTabButtonSelector = 'tab-4';
  // mainnetTabButtonSelector = 'tab-network-mainnet';
  // testnetTabButtonSelector = 'tab-network-testnet';
  // previewnetTabButtonSelector = 'tab-network-previewnet';
  // localNodeTabButtonSelector = 'tab-network-local-node';
  // customNodeTabButtonSelector = 'tab-network-custom-node';
  darkTabButtonSelector = 'tab-appearance-dark';
  lightTabButtonSelector = 'tab-appearance-light';
  systemTabButtonSelector = 'tab-appearance-system';
  restoreButtonSelector = 'button-restore';
  continueButtonSelector = 'button-continue';
  continueIndexButtonSelector = 'button-continue-index';
  continueNicknameButtonSelector = 'button-continue-nickname';
  continuePhraseButtonSelector = 'button-continue-phrase';
  importButtonSelector = 'button-restore-dropdown';
  ed25519ImportLinkSelector = 'link-import-ed25519-key';
  ecdsaImportLinkSelector = 'link-import-ecdsa-key';
  ed25519ImportButtonSelector = 'button-ed25519-private-key-import';
  ecdsaImportButtonSelector = 'button-ecdsa-private-key-import';
  decryptMainPrivateKeyButtonSelector = 'span-show-modal-0';
  deleteKeyPairButton = 'button-delete-keypair';
  deleteKeyButtonPrefix = 'button-delete-key-';
  changePasswordButtonSelector = 'button-change-password';
  confirmChangePasswordButtonSelector = 'button-confirm-change-password';
  closeButtonSelector = 'button-close';
  changeKeyNicknameButtonSelector = 'button-change-key-nickname';
  confirmNicknameChangeButtonSelector = 'button-confirm-update-nickname';

  // Text
  decryptedPrivateKeySelector = 'span-private-key-0';

  // Prefixes
  indexCellSelectorPrefix = 'cell-index-';
  nicknameCellSelectorPrefix = 'cell-nickname-';
  accountIdCellSelectorPrefix = 'cell-account-';
  keyTypeCellSelectorPrefix = 'cell-key-type-';
  publicKeyCellSelectorPrefix = 'span-public-key-';

  async verifySettingsElements(): Promise<boolean> {
    const checks = await Promise.all([
      this.isElementVisible(this.generalTabButtonSelector),
      this.isElementVisible(this.organisationsTabButtonSelector),
      this.isElementVisible(this.keysTabButtonSelector),
      this.isElementVisible(this.profileTabButtonSelector),
      // this.isElementVisible(this.mainnetTabButtonSelector),
      // this.isElementVisible(this.testnetTabButtonSelector),
      // this.isElementVisible(this.previewnetTabButtonSelector),
      // this.isElementVisible(this.localNodeTabButtonSelector),
      this.isElementVisible(this.darkTabButtonSelector),
      this.isElementVisible(this.lightTabButtonSelector),
      this.isElementVisible(this.systemTabButtonSelector),
    ]);

    return checks.every(isTrue => isTrue);
  }

  async incrementIndex(): Promise<void> {
    let numericValue = parseInt(this.currentIndex);
    numericValue++;
    this.currentIndex = numericValue.toString();
  }

  async decrementIndex(): Promise<void> {
    let numericValue = parseInt(this.currentIndex);
    numericValue--;
    this.currentIndex = numericValue.toString();
  }

  // Function to verify keys exist for a given index and user's email
  async verifyKeysExistByIndexAndEmail(email: string, index: number): Promise<boolean> {
    const query = `
      SELECT public_key, private_key
      FROM KeyPair kp
      JOIN User u ON u.id = kp.user_id
      WHERE u.email = ? AND kp."index" = ?`;

    try {
      const row = await queryDatabase(query, [email, index]) as { public_key: string|undefined, private_key: string|undefined};
      return row !== undefined && row.public_key !== undefined && row.private_key !== undefined;
    } catch (error) {
      console.error('Error verifying keys for index:', error);
      return false;
    }
  }

  async getKeyRowCount(): Promise<number> {
    return await this.countElements(this.indexCellSelectorPrefix);
  }

  async getRowDataByIndex(index: number) {
    return {
      index: await this.getText(this.indexCellSelectorPrefix + index),
      nickname: await this.getText(this.nicknameCellSelectorPrefix + index),
      accountID: await this.getText(this.accountIdCellSelectorPrefix + index),
      keyType: await this.getText(this.keyTypeCellSelectorPrefix + index),
      publicKey: await this.getText(this.publicKeyCellSelectorPrefix + index),
    };
  }

  async clickOnSettingsButton(): Promise<void> {
    await this.click(this.settingsButtonSelector);
  }

  async clickOnKeysTab(): Promise<void> {
    await this.click(this.keysTabButtonSelector);
  }

  async clickOnProfileTab(): Promise<void> {
    await this.click(this.profileTabButtonSelector);
  }

  async clickOnRestoreButton(): Promise<void> {
    const maxRetries = 10;
    let attempt = 0;

    while (attempt < maxRetries) {
      await this.click(this.restoreButtonSelector);
      if (await this.isElementVisible(this.continuePhraseButtonSelector, null, 3000)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempt++;
    }

    throw new Error(
      `Failed to click on restore button and see continue button after ${maxRetries} attempts`,
    );
  }

  async clickOnContinueButton(): Promise<void> {
    await this.click(this.continueButtonSelector, null, 25000);
  }

  async fillInIndex(index = 1): Promise<void> {
    await this.fill(this.indexInputSelector, index.toString());
  }

  async clickOnIndexContinueButton(): Promise<void> {
    await this.click(this.continueIndexButtonSelector);
  }

  async fillInNickname(nickname: string): Promise<void> {
    await this.fill(this.nicknameInputSelector, nickname);
  }

  async clickOnNicknameContinueButton(): Promise<void> {
    await this.click(this.continueNicknameButtonSelector, null, 12000);
  }

  async clickOnContinuePhraseButton(): Promise<void> {
    await this.click(this.continuePhraseButtonSelector);
  }

  // async clickOnLocalNodeTab(): Promise<void> {
  //   await this.click(this.localNodeTabButtonSelector);
  // }
  //
  // async clickOnTestnetTab(): Promise<void> {
  //   await this.click(this.testnetTabButtonSelector);
  // }
  //
  // async clickOnPreviewnetTab(): Promise<void> {
  //   await this.click(this.previewnetTabButtonSelector);
  // }
  //
  // async clickOnCustomNodeTab(): Promise<void> {
  //   await this.click(this.customNodeTabButtonSelector);
  // }
  //
  async clickOnImportButton(): Promise<void> {
    await this.click(this.importButtonSelector);
  }

  async clickOnECDSADropDown(): Promise<void> {
    await this.click(this.ecdsaImportLinkSelector);
  }

  async clickOnED25519DropDown(): Promise<void> {
    await this.click(this.ed25519ImportLinkSelector);
  }

  async fillInMirrorNodeBaseURL(mirrorNodeBaseURL: string): Promise<void> {
    await this.fill(this.mirrorNodeBaseURLInputSelector, mirrorNodeBaseURL);
  }

  async fillInECDSAPrivateKey(ecdsaPrivateKey: string): Promise<void> {
    await this.fill(this.ecdsaPrivateKeyInputSelector, ecdsaPrivateKey);
  }

  async fillInED25519PrivateKey(ecdsaPrivateKey: string): Promise<void> {
    await this.fill(this.ed25519PrivateKeyInputSelector, ecdsaPrivateKey);
  }

  async fillInECDSANickname(ecdsaNickname: string): Promise<void> {
    await this.fill(this.ecdsaNicknameInputSelector, ecdsaNickname);
  }

  async fillInED25519Nickname(ecdsaNickname: string): Promise<void> {
    await this.fill(this.ed25519PNicknameInputSelector, ecdsaNickname);
  }

  async clickOnECDSAImportButton(): Promise<void> {
    await this.click(this.ecdsaImportButtonSelector);
  }

  async clickOnED25519ImportButton(): Promise<void> {
    await this.click(this.ed25519ImportButtonSelector);
  }

  async clickOnEyeDecryptIcon(): Promise<void> {
    await this.click(this.decryptMainPrivateKeyButtonSelector);
  }

  async getPrivateKeyText(): Promise<string|string[]|null> {
    return await this.getText(this.decryptedPrivateKeySelector);
  }

  async clickOnDeleteButtonAtIndex(index: number): Promise<void> {
    await this.click(this.deleteKeyButtonPrefix + index);
  }

  async clickOnDeleteKeyPairButton(): Promise<void> {
    await this.click(this.deleteKeyPairButton);
  }

  async fillInCurrentPassword(password: string): Promise<void> {
    await this.fill(this.currentPasswordInputSelector, password);
  }

  async fillInNewPassword(password: string): Promise<void> {
    await this.fill(this.newPasswordInputSelector, password);
  }

  async clickOnChangePasswordButton(): Promise<void> {
    await this.click(this.changePasswordButtonSelector);
  }

  async clickOnConfirmChangePassword(): Promise<void> {
    await this.click(this.confirmChangePasswordButtonSelector);
  }

  async clickOnCloseButton(): Promise<void> {
    await this.waitForElementToBeVisible(this.closeButtonSelector, 15000);
    await this.click(this.closeButtonSelector);
  }

  async clickOnOrganisationsTab(): Promise<void> {
    await this.click(this.organisationsTabButtonSelector);
  }

  async fillInDefaultMaxTransactionFee(fee: string): Promise<void> {
    await this.fill(this.defaultMaxTransactionFeeInputSelector, fee);
  }

  async clickOnChangeKeyNicknameButton(index: number|null): Promise<void> {
    await this.click(this.changeKeyNicknameButtonSelector, index);
  }

  async clickOnConfirmNicknameChangeButton(): Promise<void> {
    await this.click(this.confirmNicknameChangeButtonSelector);
  }

  async fillInKeyPairNickname(nickname: string): Promise<void> {
    await this.fill(this.keyPairNicknameInputSelector, nickname);
  }

  async changeNicknameForFirstKey(nickname: string): Promise<void> {
    await this.clickOnChangeKeyNicknameButton(0);
    await this.fillInKeyPairNickname(nickname);
    await this.clickOnConfirmNicknameChangeButton();
  }

  async navigateToLogout(resetFunction: (() => Promise<void>) | null = null): Promise<void> {
    const isSettingsButtonHidden = await this.isElementHidden(this.settingsButtonSelector);
    if (isSettingsButtonHidden) {
      console.log('Settings button is not visible, resetting the form');
      if (resetFunction) {
        await resetFunction();
      }
      return;
    }
    await this.click(this.settingsButtonSelector);

    const isProfileTabButtonHidden = await this.isElementHidden(this.profileTabButtonSelector);
    if (isProfileTabButtonHidden) {
      console.log('Profile tab button is not visible, resetting the form');
      if (resetFunction) {
        await resetFunction();
      }
      return;
    }
    await this.click(this.profileTabButtonSelector);
  }
}
