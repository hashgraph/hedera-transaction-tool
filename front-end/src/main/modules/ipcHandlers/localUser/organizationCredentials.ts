import {
  getOrganizationTokens,
  shouldSignInOrganization,
  addOrganizationCredentials,
  updateOrganizationCredentials,
  deleteOrganizationCredentials,
  tryAutoSignIn,
  getOrganizationCredentials,
  encryptOrganizationPassword,
} from '@main/services/localUser';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Organization Credentials */
  createIPCChannel('organizationCredentials', [
    renameFunc(getOrganizationTokens, 'getOrganizationTokens'),
    renameFunc(shouldSignInOrganization, 'shouldSignInOrganization'),
    renameFunc(addOrganizationCredentials, 'addOrganizationCredentials'),
    renameFunc(updateOrganizationCredentials, 'updateOrganizationCredentials'),
    renameFunc(deleteOrganizationCredentials, 'deleteOrganizationCredentials'),
    renameFunc(getOrganizationCredentials, 'getOrganizationCredentials'),
    renameFunc(tryAutoSignIn, 'tryAutoSignIn'),
    renameFunc(encryptOrganizationPassword, 'encryptOrganizationPassword'),
  ]);
};
