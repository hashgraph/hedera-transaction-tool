import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerOrganizationCredentialsHandlers from '@main/modules/ipcHandlers/localUser/organizationCredentials';

import {
  getOrganizationTokens,
  organizationsToSignIn,
  shouldSignInOrganization,
  addOrganizationCredentials,
  updateOrganizationCredentials,
  deleteOrganizationCredentials,
  tryAutoSignIn,
} from '@main/services/localUser';

vi.mock('@main/services/localUser', () => mockDeep());

describe('IPC handlers organization credentials', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerOrganizationCredentialsHandlers();
  });

  const user_id = 'userId';
  const email = 'email';
  const password = 'password';
  const organization_id = 'organizationId';
  const jwtToken = 'token';
  const encryptPassword = 'encryptPassword';
  const decryptPassword = 'decryptPassword';
  const updateIfExists = false;

  test('Should register handlers for each event', () => {
    const events = [
      'getOrganizationTokens',
      'organizationsToSignIn',
      'shouldSignInOrganization',
      'addOrganizationCredentials',
      'updateOrganizationCredentials',
      'deleteOrganizationCredentials',
      'tryAutoSignIn',
    ];
    expect(events.every(e => getIPCHandler(`organizationCredentials:${e}`))).toBe(true);
  });

  test('Should set up getOrganizationTokens handler', async () => {
    await invokeIPCHandler('organizationCredentials:getOrganizationTokens', user_id);
    expect(getOrganizationTokens).toHaveBeenCalledWith(user_id);
  });

  test('Should set up organizationsToSignIn handler', async () => {
    await invokeIPCHandler('organizationCredentials:organizationsToSignIn', user_id);
    expect(organizationsToSignIn).toHaveBeenCalledWith(user_id);
  });

  test('Should set up shouldSignInOrganization handler', async () => {
    const organization_id = 'organizationId';
    await invokeIPCHandler(
      'organizationCredentials:shouldSignInOrganization',
      user_id,
      organization_id,
    );
    expect(shouldSignInOrganization).toHaveBeenCalledWith(user_id, organization_id);
  });

  test('Should set up addOrganizationCredentials handler', async () => {
    await invokeIPCHandler(
      'organizationCredentials:addOrganizationCredentials',
      email,
      password,
      organization_id,
      user_id,
      jwtToken,
      encryptPassword,
      updateIfExists,
    );
    expect(addOrganizationCredentials).toHaveBeenCalledWith(
      email,
      password,
      organization_id,
      user_id,
      jwtToken,
      encryptPassword,
      updateIfExists,
    );
  });

  test('Should set up updateOrganizationCredentials handler', async () => {
    await invokeIPCHandler(
      'organizationCredentials:updateOrganizationCredentials',
      organization_id,
      user_id,
      email,
      password,
      jwtToken,
      encryptPassword,
    );
    expect(updateOrganizationCredentials).toHaveBeenCalledWith(
      organization_id,
      user_id,
      email,
      password,
      jwtToken,
      encryptPassword,
    );
  });

  test('Should set up deleteOrganizationCredentials handler', async () => {
    await invokeIPCHandler(
      'organizationCredentials:deleteOrganizationCredentials',
      organization_id,
      user_id,
    );
    expect(deleteOrganizationCredentials).toHaveBeenCalledWith(organization_id, user_id);
  });

  test('Should set up tryAutoSignIn handler', async () => {
    await invokeIPCHandler('organizationCredentials:tryAutoSignIn', user_id, decryptPassword);
    expect(tryAutoSignIn).toHaveBeenCalledWith(user_id, decryptPassword);
  });
});
