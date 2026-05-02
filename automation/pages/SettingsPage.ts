import { Page } from '@playwright/test';
import { BasePage } from './BasePage.js';
import { getKeyPairByIndexAndEmail } from '../utils/db/databaseQueries.js';

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
  encryptPasswordInputSelector = 'input-encrypt-password';
  defaultOrganizationDropdownSelector = 'dropdown-default-organization';
  dateTimeFormatDropdownSelector = 'dropdown-date-time-format';
  addOrganizationServerUrlInputSelector = 'input-server-url';
  importPublicKeyMappingInputSelector = 'input-public-key-mapping';
  importPublicKeyNicknameInputSelector =
    'css=[data-testid="input-public-key-nickname"][name="nickname"]';
  renamePublicKeyNicknameInputSelector =
    'css=[data-testid="input-public-key-nickname"][name="key-pair-nickname"]';

  // Buttons
  settingsButtonSelector = 'button-menu-settings';
  generalTabButtonSelector = 'tab-0';
  organisationsTabButtonSelector = 'tab-1';
  keysTabButtonSelector = 'tab-2';
  publicKeysTabButtonSelector = 'tab-3';
  profileTabButtonSelector = 'tab-4';
  notificationsTabButtonSelector = 'tab-5';
  mainnetTabButtonSelector = 'tab-network-mainnet';
  testnetTabButtonSelector = 'tab-network-testnet';
  previewnetTabButtonSelector = 'tab-network-previewnet';
  localNodeTabButtonSelector = 'tab-network-local-node';
  customNodeTabButtonSelector = 'tab-network-custom';
  darkTabButtonSelector = 'tab-appearance-dark';
  lightTabButtonSelector = 'tab-appearance-light';
  systemTabButtonSelector = 'tab-appearance-system';
  restoreButtonSelector = 'button-restore';
  continueIndexButtonSelector = 'button-continue-index';
  continueNicknameButtonSelector = 'button-continue-nickname';
  continuePhraseButtonSelector = 'button-continue-phrase';
  continueEncryptPasswordButtonSelector = 'button-continue-encrypt-password';
  cancelEncryptPasswordButtonSelector = 'button-cancel-encrypt-password';
  importButtonSelector = 'button-restore-dropdown';
  ed25519ImportLinkSelector = 'link-import-ed25519-key';
  ecdsaImportLinkSelector = 'link-import-ecdsa-key';
  ed25519ImportButtonSelector = 'button-ed25519-private-key-import';
  ecdsaImportButtonSelector = 'button-ecdsa-private-key-import';
  decryptMainPrivateKeyButtonSelector = 'span-show-modal-0';
  deleteKeyPairButton = 'button-delete-keypair';
  deleteKeyButtonPrefix = 'button-delete-key-';
  deleteKeyAllButton = 'button-delete-key-all';
  changePasswordButtonSelector = 'button-change-password';
  confirmChangePasswordButtonSelector = 'button-confirm-change-password';
  closeButtonSelector = 'button-close';
  changeKeyNicknameButtonSelector = 'button-change-key-nickname';
  confirmNicknameChangeButtonSelector = 'button-confirm-update-nickname';
  dateTimeFormatUtcOptionSelector = 'select-item-utc-time';
  dateTimeFormatLocalOptionSelector = 'select-item-local-time';
  allKeysTabSelector = 'tab-All';
  privateKeyFilterTabSelector = 'tab-Imported from Private Key';
  recoveryPhraseFilterDropdownSelector = 'dropdown-recovery-phrase-filter';
  connectOrganizationButtonSelector = 'css=button:has-text("Connect now")';
  addOrganizationInModalButtonSelector = 'button-add-organization-in-modal';
  importPublicKeyDropdownButtonSelector = 'button-import-public-dropdown';
  importSinglePublicKeyButtonSelector = 'import-single-public-key';
  importPublicKeyButtonSelector = 'button-public-key-import';
  deletePublicKeyMappingButtonSelector = 'button-delete-public-key-mapping';
  selectAllPublicKeysCheckboxSelector = 'checkbox-select-all-public-keys';
  deleteAllPublicKeysButtonSelector = 'button-delete-public-all';

  // Text
  decryptedPrivateKeySelector = 'span-private-key-0';
  organizationsEmptyStateSelector = 'text=There are no connected organizations.';
  publicKeysTableHeaderSelector = 'css=.table-custom thead th';
  organizationsTableHeaderSelector = 'css=.table-custom thead th';
  organizationConnectionStatusBadgeSelector = 'connection-status-badge';
  organizationVersionInfoCellSelector = 'css=.table-custom tbody tr td:nth-child(4)';
  organizationServerUrlCellSelector = 'css=.table-custom tbody tr td:nth-child(2) p';
  organizationStatusCellSelector = 'css=.table-custom tbody tr td:nth-child(3)';

  // Notification preference toggles in Settings → Notifications.
  // AppSwitch renders an <input role="switch"> and forwards the `name` attribute.
  notificationToggleNameReadyForExecution = 'threshold-reached';
  notificationToggleNameSignatureRequired = 'required-signatures';
  notificationToggleNameCancelled = 'transaction-cancelled';
  notificationToggleNameExecuted = 'transaction-executed';
  notificationToggleNameExpired = 'transaction-expired';
  updateAvailableHeadingSelector = 'css=h2:has-text("Update Available")';

  // Input
  selectAllKeysCheckboxSelector = 'checkbox-select-all-keys';

  // Prefixes
  indexCellSelectorPrefix = 'cell-index-';
  nicknameCellSelectorPrefix = 'cell-nickname-';
  accountIdCellSelectorPrefix = 'cell-account-';
  keyTypeCellSelectorPrefix = 'cell-key-type-';
  publicKeyCellSelectorPrefix = 'span-public-key-';
  copyPublicKeyButtonSelectorPrefix = 'span-copy-public-key-';
  copyPrivateKeyButtonSelectorPrefix = 'span-copy-private-key-';
  keyCheckboxPrefixSelector = 'checkbox-multiple-keys-id-';
  publicKeyNicknameCellSelectorPrefix = 'cell-public-nickname-';

  async verifySettingsElements(): Promise<boolean> {
    const checks = await Promise.all([
      this.isElementVisible(this.generalTabButtonSelector),
      this.isElementVisible(this.organisationsTabButtonSelector),
      this.isElementVisible(this.keysTabButtonSelector),
      this.isElementVisible(this.profileTabButtonSelector),
      this.isElementVisible(this.mainnetTabButtonSelector),
      this.isElementVisible(this.testnetTabButtonSelector),
      this.isElementVisible(this.previewnetTabButtonSelector),
      this.isElementVisible(this.localNodeTabButtonSelector),
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

  async verifyKeysExistByIndexAndEmail(email: string, index: number): Promise<boolean> {
    const row = await getKeyPairByIndexAndEmail(email, index);
    return row !== null && row.public_key !== undefined && row.private_key !== undefined;
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

  async clickOnPublicKeysTab(): Promise<void> {
    await this.click(this.publicKeysTabButtonSelector);
  }

  async isOrganizationsEmptyStateVisible(): Promise<boolean> {
    return await this.isElementVisible(this.organizationsEmptyStateSelector);
  }

  async clickOnConnectOrganizationButton(): Promise<void> {
    await this.click(this.connectOrganizationButtonSelector);
  }

  async fillInAddOrganizationServerUrl(serverUrl: string): Promise<void> {
    await this.fill(this.addOrganizationServerUrlInputSelector, serverUrl);
  }

  async clickOnAddOrganizationInModalButton(): Promise<void> {
    await this.click(this.addOrganizationInModalButtonSelector);
  }

  async getPublicKeysTableHeaderText(): Promise<string> {
    const headers = await this.getElement(this.publicKeysTableHeaderSelector).allTextContents();
    return headers.map(h => h.trim()).join(' ');
  }

  async getOrganizationsTableHeaders(): Promise<string[]> {
    const headers = await this.getElement(this.organizationsTableHeaderSelector).allTextContents();
    return headers.map(h => h.trim());
  }

  async getOrganizationConnectionStatusBadgeText(rowIndex = 0): Promise<string> {
    const text = await this.getText(this.organizationConnectionStatusBadgeSelector, rowIndex);
    return (text ?? '').trim();
  }

  async getOrganizationServerUrlAtIndex(rowIndex = 0): Promise<string> {
    const text = await this.getElement(this.organizationServerUrlCellSelector)
      .nth(rowIndex)
      .textContent();
    return (text ?? '').trim();
  }

  async getOrganizationVersionInfoText(rowIndex = 0): Promise<string> {
    const text = await this.getElement(this.organizationVersionInfoCellSelector)
      .nth(rowIndex)
      .textContent();
    return (text ?? '').trim();
  }

  async getOrganizationStatusCellText(rowIndex = 0): Promise<string> {
    const text = await this.getElement(this.organizationStatusCellSelector)
      .nth(rowIndex)
      .textContent();
    return (text ?? '').trim();
  }

  private getNotificationToggleSelector(name: string): string {
    return `css=input[role="switch"][name="${name}"]`;
  }

  async clickOnNotificationToggle(name: string): Promise<void> {
    await this.click(this.getNotificationToggleSelector(name));
  }

  async isNotificationToggleChecked(name: string): Promise<boolean> {
    return await this.getElement(this.getNotificationToggleSelector(name)).isChecked();
  }

  async toggleNotificationAndExpectChange(name: string): Promise<{
    initial: boolean;
    afterToggle: boolean;
  }> {
    const initial = await this.isNotificationToggleChecked(name);
    await this.clickOnNotificationToggle(name);
    const afterToggle = await this.isNotificationToggleChecked(name);
    return { initial, afterToggle };
  }

  async isUpdateAvailableModalVisible(timeout = this.LONG_TIMEOUT): Promise<boolean> {
    return await this.isElementVisible(this.updateAvailableHeadingSelector, null, timeout);
  }

  async clickOnImportPublicKeyDropdown(): Promise<void> {
    await this.click(this.importPublicKeyDropdownButtonSelector);
  }

  async clickOnImportSinglePublicKeyButton(): Promise<void> {
    await this.click(this.importSinglePublicKeyButtonSelector);
  }

  async openImportSinglePublicKeyModal(): Promise<void> {
    await this.clickOnImportPublicKeyDropdown();
    await this.clickOnImportSinglePublicKeyButton();
  }

  async isImportPublicKeyButtonDisabled(): Promise<boolean> {
    return await this.isDisabled(this.importPublicKeyButtonSelector);
  }

  async isImportPublicKeyButtonEnabled(): Promise<boolean> {
    return await this.isButtonEnabled(this.importPublicKeyButtonSelector);
  }

  async fillInPublicKeyMapping(publicKey: string): Promise<void> {
    await this.fill(this.importPublicKeyMappingInputSelector, publicKey);
  }

  async fillInImportPublicKeyNickname(nickname: string): Promise<void> {
    await this.fill(this.importPublicKeyNicknameInputSelector, nickname);
  }

  async fillInImportPublicKeyForm(publicKey: string, nickname: string): Promise<void> {
    await this.fillInPublicKeyMapping(publicKey);
    await this.fillInImportPublicKeyNickname(nickname);
  }

  async clickOnImportPublicKeyButton(): Promise<void> {
    await this.click(this.importPublicKeyButtonSelector);
  }

  async clickOnCopyPublicKeyMappingAtIndex(index: number): Promise<void> {
    await this.click(this.copyPublicKeyButtonSelectorPrefix + index);
  }

  async renamePublicKeyMappingAtIndex(index: number, nickname: string): Promise<void> {
    await this.clickOnChangeKeyNicknameButton(index);
    await this.fill(this.renamePublicKeyNicknameInputSelector, nickname);
    await this.clickOnConfirmNicknameChangeButton();
  }

  async getPublicKeyMappingNicknameAtIndex(index: number): Promise<string> {
    return ((await this.getText(this.publicKeyNicknameCellSelectorPrefix + index)) ?? '').trim();
  }

  async clickOnDeletePublicKeyMappingAtIndex(index: number): Promise<void> {
    await this.click(this.deleteKeyButtonPrefix + index);
  }

  async confirmDeletePublicKeyMapping(): Promise<void> {
    await this.click(this.deletePublicKeyMappingButtonSelector);
  }

  async clickOnSelectAllPublicKeys(): Promise<void> {
    await this.click(this.selectAllPublicKeysCheckboxSelector);
  }

  async clickOnDeleteAllPublicKeys(): Promise<void> {
    await this.click(this.deleteAllPublicKeysButtonSelector);
  }

  async clickOnProfileTab(): Promise<void> {
    await this.click(this.profileTabButtonSelector);
  }

  async isNotificationsTabVisible(): Promise<boolean> {
    return await this.isElementVisible(this.notificationsTabButtonSelector);
  }

  async clickOnNotificationsTab(): Promise<void> {
    await this.click(this.notificationsTabButtonSelector);
    // Tab click resolves before the panel mounts; wait for the first toggle to attach
    // so later reads don't race the render on slow CI.
    await this.waitForElementToBeAttached(
      this.getNotificationToggleSelector(this.notificationToggleNameReadyForExecution),
      this.VERY_LONG_TIMEOUT,
    );
  }

  async clickOnDarkThemeTab(): Promise<void> {
    await this.click(this.darkTabButtonSelector);
  }

  async clickOnLightThemeTab(): Promise<void> {
    await this.click(this.lightTabButtonSelector);
  }

  async isDarkThemeTabActive(): Promise<boolean> {
    return await this.isElementActive(this.darkTabButtonSelector);
  }

  async isLightThemeTabActive(): Promise<boolean> {
    return await this.isElementActive(this.lightTabButtonSelector);
  }

  async clickOnRestoreButton(): Promise<void> {
    const maxRetries = 30;
    let attempt = 0;

    while (attempt < maxRetries) {
      await this.click(this.restoreButtonSelector);
      if (await this.isElementVisible(this.continuePhraseButtonSelector)) {
        return;
      }
      attempt++;
    }

    throw new Error(
      `Failed to click on restore button and see continue button after ${maxRetries} attempts`,
    );
  }

  async clickOnDeleteKeyAllButton(): Promise<void> {
    await this.click(this.deleteKeyAllButton);
  }

  async isDeleteKeyAllButtonVisible(): Promise<boolean> {
    return await this.isElementVisible(this.deleteKeyAllButton);
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
    await this.click(this.continueNicknameButtonSelector, null, this.LONG_TIMEOUT);
  }

  async clickOnContinuePhraseButton(): Promise<void> {
    await this.click(this.continuePhraseButtonSelector);
  }

  async clickOnLocalNodeTab(): Promise<void> {
    await this.click(this.localNodeTabButtonSelector);
  }

  async clickOnTestnetTab(): Promise<void> {
    await this.click(this.testnetTabButtonSelector);
  }

  async clickOnPreviewnetTab(): Promise<void> {
    await this.click(this.previewnetTabButtonSelector);
  }

  async clickOnCustomNodeTab(): Promise<void> {
    await this.click(this.customNodeTabButtonSelector);
  }

  async isCustomNodeTabActive(): Promise<boolean> {
    return await this.isElementActive(this.customNodeTabButtonSelector);
  }

  async clickOnImportButton(): Promise<void> {
    await this.click(this.importButtonSelector);
  }

  async clickOnECDSADropDown(): Promise<void> {
    await this.click(this.ecdsaImportLinkSelector);
  }

  async clickOnED25519DropDown(): Promise<void> {
    await this.click(this.ed25519ImportLinkSelector);
  }

  async clickOnSelectAllKeys(): Promise<void> {
    await this.click(this.selectAllKeysCheckboxSelector);
  }

  async clickOnKeyCheckboxByIndex(index: number): Promise<void> {
    await this.click(this.keyCheckboxPrefixSelector + index);
  }

  async fillInMirrorNodeBaseURL(mirrorNodeBaseURL: string): Promise<void> {
    await this.fill(this.mirrorNodeBaseURLInputSelector, mirrorNodeBaseURL);
  }

  async applyMirrorNodeBaseURL(): Promise<void> {
    await this.click(this.mirrorNodeBaseURLInputSelector);
    await this.pressKey('Tab');
  }

  async isMirrorNodeBaseURLInputVisible(): Promise<boolean> {
    return await this.isElementVisible(this.mirrorNodeBaseURLInputSelector);
  }

  async getMirrorNodeBaseURL(): Promise<string> {
    return await this.getTextFromInputField(this.mirrorNodeBaseURLInputSelector);
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

  async clickOnECDSAImportButton(expectModalToClose = true): Promise<void> {
    await this.click(this.ecdsaImportButtonSelector);
    if (
      expectModalToClose &&
      !(await this.isElementHidden(this.ecdsaImportButtonSelector, null, this.LONG_TIMEOUT))
    ) {
      throw new Error('Import modal did not close within 10 seconds');
    }
  }

  async clickOnED25519ImportButton(expectModalToClose = true): Promise<void> {
    await this.click(this.ed25519ImportButtonSelector);
    if (
      expectModalToClose &&
      !(await this.isElementHidden(this.ed25519ImportButtonSelector, null, this.LONG_TIMEOUT))
    ) {
      throw new Error('Import modal did not close within 10 seconds');
    }
  }

  async clickOnEyeDecryptIcon(): Promise<void> {
    await this.click(this.decryptMainPrivateKeyButtonSelector);
  }

  async getPrivateKeyText(): Promise<string|string[]|null> {
    return await this.getText(this.decryptedPrivateKeySelector);
  }

  async isPrivateKeyVisible(): Promise<boolean> {
    return await this.isElementVisible(this.decryptedPrivateKeySelector);
  }

  async isEncryptPasswordInputVisible(): Promise<boolean> {
    return await this.isElementVisible(this.encryptPasswordInputSelector);
  }

  async fillInEncryptPassword(password: string): Promise<void> {
    await this.fill(this.encryptPasswordInputSelector, password);
  }

  async clickOnContinueEncryptPasswordButton(): Promise<void> {
    await this.click(this.continueEncryptPasswordButtonSelector);
  }

  async clearCachedPersonalPasswordForTesting(): Promise<void> {
    await this.window.evaluate(() => {
      type VueAppContainer = HTMLElement & {
        __vue_app__?: {
          config?: {
            globalProperties?: {
              $pinia?: {
                _s?: Map<string, { personal?: { password?: string } }>;
              };
            };
          };
        };
      };

      const appRoot = document.querySelector('#app') as VueAppContainer | null;
      const userStore = appRoot?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get('user');

      if (userStore?.personal) {
        userStore.personal.password = '';
      }
    });
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

  async isConfirmChangePasswordButtonVisible(): Promise<boolean> {
    return await this.isElementVisible(this.confirmChangePasswordButtonSelector);
  }

  async clickOnCloseButton(): Promise<void> {
    await this.waitForElementToBeVisible(this.closeButtonSelector, this.LONG_TIMEOUT * 2);
    await this.click(this.closeButtonSelector);
  }

  async clickOnCopyPublicKeyAtIndex(index: number): Promise<void> {
    await this.click(this.copyPublicKeyButtonSelectorPrefix + index);
  }

  async clickOnCopyPrivateKeyAtIndex(index: number): Promise<void> {
    await this.click(this.copyPrivateKeyButtonSelectorPrefix + index);
  }

  async clickOnCancelEncryptPasswordButton(): Promise<void> {
    await this.click(this.cancelEncryptPasswordButtonSelector);
  }

  async clickOnOrganisationsTab(): Promise<void> {
    await this.click(this.organisationsTabButtonSelector);
  }

  async fillInDefaultMaxTransactionFee(fee: string): Promise<void> {
    await this.fill(this.defaultMaxTransactionFeeInputSelector, fee);
  }

  async clickOnDefaultOrganizationDropdown(): Promise<void> {
    await this.click(this.defaultOrganizationDropdownSelector);
  }

  async selectDefaultOrganizationByLabel(label: string): Promise<void> {
    await this.clickOnDefaultOrganizationDropdown();
    await this.click(this.getVisibleDropdownItemByLabelSelector(label));
  }

  async getSelectedDefaultOrganizationLabel(): Promise<string> {
    return ((await this.getText(this.defaultOrganizationDropdownSelector)) ?? '').trim();
  }

  async clickOnAllKeysFilterTab(): Promise<void> {
    await this.click(this.allKeysTabSelector);
  }

  async clickOnPrivateKeyFilterTab(): Promise<void> {
    await this.click(this.privateKeyFilterTabSelector);
  }

  async clickOnRecoveryPhraseFilterDropdown(): Promise<void> {
    await this.click(this.recoveryPhraseFilterDropdownSelector);
  }

  async selectFirstRecoveryPhraseFilterOption(): Promise<void> {
    await this.clickOnRecoveryPhraseFilterDropdown();
    await this.click('css=ul.dropdown-menu.show li.dropdown-item', 0);
  }

  async clickOnDateTimeFormatDropdown(): Promise<void> {
    await this.click(this.dateTimeFormatDropdownSelector);
  }

  async selectDateTimeFormatLocalTime(): Promise<void> {
    await this.clickOnDateTimeFormatDropdown();
    await this.click(this.dateTimeFormatLocalOptionSelector);
  }

  async selectDateTimeFormatUtcTime(): Promise<void> {
    await this.clickOnDateTimeFormatDropdown();
    await this.click(this.dateTimeFormatUtcOptionSelector);
  }

  async getSelectedDateTimeFormatLabel(): Promise<string> {
    return ((await this.getText(this.dateTimeFormatDropdownSelector)) ?? '').trim();
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

  private getVisibleDropdownItemByLabelSelector(label: string): string {
    const escapedLabel = label.replace(/"/g, '\\"');
    return `css=ul.dropdown-menu.show li.dropdown-item:has-text("${escapedLabel}")`;
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
