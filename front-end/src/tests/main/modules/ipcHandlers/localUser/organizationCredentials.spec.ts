import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

import registerOrganizationCredentialsHandlers from '@main/modules/ipcHandlers/localUser/organizationCredentials';

import {
  getConnectedOrganizations,
  organizationsToSignIn,
  shouldSignInOrganization,
  addOrganizationCredentials,
  updateOrganizationCredentials,
  deleteOrganizationCredentials,
  tryAutoSignIn,
} from '@main/services/localUser';
import { ipcMain } from 'electron';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser', () => ({
  getConnectedOrganizations: vi.fn(),
  organizationsToSignIn: vi.fn(),
  shouldSignInOrganization: vi.fn(),
  addOrganizationCredentials: vi.fn(),
  updateOrganizationCredentials: vi.fn(),
  deleteOrganizationCredentials: vi.fn(),
  tryAutoSignIn: vi.fn(),
}));

describe('IPC handlers organization credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerOrganizationCredentialsHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const ежент = [
      'getConnectedOrganizations',
      'organizationsToSignIn',
      'shouldSignInOrganization',
      'addOrganizationCredentials',
      'updateOrganizationCredentials',
      'deleteOrganizationCredentials',
      'tryAutoSignIn',
    ];

    expect(
      ежент.every(е =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `organizationCredentials:${е}`),
      ),
    ).toBe(true);
  });

  test('Should set up getConnectedOrganizations handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'organizationCredentials:getConnectedOrganizations',
    );
    expect(handler).toBeDefined();

    const user_id = 'userId';

    handler && (await handler[1](event, user_id));
    expect(getConnectedOrganizations).toHaveBeenCalledWith(user_id);
  });

  test('Should set up organizationsToSignIn handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'organizationCredentials:organizationsToSignIn',
    );
    expect(handler).toBeDefined();

    const user_id = 'userId';

    handler && (await handler[1](event, user_id));
    expect(organizationsToSignIn).toHaveBeenCalledWith(user_id);
  });

  test('Should set up shouldSignInOrganization handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'organizationCredentials:shouldSignInOrganization',
    );
    expect(handler).toBeDefined();

    const user_id = 'userId';
    const organization_id = 'organizationId';

    handler && (await handler[1](event, user_id, organization_id));
    expect(shouldSignInOrganization).toHaveBeenCalledWith(user_id, organization_id);
  });

  test('Should set up addOrganizationCredentials handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'organizationCredentials:addOrganizationCredentials',
    );
    expect(handler).toBeDefined();

    const email = 'email';
    const password = 'password';
    const organization_id = 'organizationId';
    const user_id = 'userId';
    const encryptPassword = 'encryptPassword';
    const updateIfExists = false;

    handler &&
      (await handler[1](
        event,
        email,
        password,
        organization_id,
        user_id,
        encryptPassword,
        updateIfExists,
      ));
    expect(addOrganizationCredentials).toHaveBeenCalledWith(
      email,
      password,
      organization_id,
      user_id,
      encryptPassword,
      updateIfExists,
    );
  });

  test('Should set up updateOrganizationCredentials handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'organizationCredentials:updateOrganizationCredentials',
    );
    expect(handler).toBeDefined();

    const organization_id = 'organizationId';
    const user_id = 'userId';
    const email = 'email';
    const password = 'password';
    const encryptPassword = 'encryptPassword';

    handler &&
      (await handler[1](event, organization_id, user_id, email, password, encryptPassword));
    expect(updateOrganizationCredentials).toHaveBeenCalledWith(
      organization_id,
      user_id,
      email,
      password,
      encryptPassword,
    );
  });

  test('Should set up deleteOrganizationCredentials handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'organizationCredentials:deleteOrganizationCredentials',
    );
    expect(handler).toBeDefined();

    const organization_id = 'organizationId';
    const user_id = 'userId';

    handler && (await handler[1](event, organization_id, user_id));
    expect(deleteOrganizationCredentials).toHaveBeenCalledWith(organization_id, user_id);
  });

  test('Should set up tryAutoSignIn handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'organizationCredentials:tryAutoSignIn',
    );
    expect(handler).toBeDefined();

    const user_id = 'userId';
    const decryptPassword = 'decryptPassword';

    handler && (await handler[1](event, user_id, decryptPassword));
    expect(tryAutoSignIn).toHaveBeenCalledWith(user_id, decryptPassword);
  });
});
