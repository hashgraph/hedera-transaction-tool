import { ipcMain } from 'electron';

import registerOrganizationsHandlers from '@main/modules/ipcHandlers/localUser/organizations';
import {
  getOrganizations,
  addOrganization,
  updateOrganization,
  removeOrganization,
} from '@main/services/localUser';
import { Prisma } from '@prisma/client';
import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser', () => ({
  getOrganizations: vi.fn(),
  addOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  removeOrganization: vi.fn(),
}));

describe('IPC handlers organizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerOrganizationsHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const event = [
      'getOrganizations',
      'addOrganization',
      'updateOrganization',
      'deleteOrganization',
    ];

    expect(
      event.every(util =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `organizations:${util}`),
      ),
    ).toBe(true);
  });

  test('Should set up getOrganizations handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'organizations:getOrganizations',
    );
    expect(handler).toBeDefined();

    handler && (await handler[1](event));
    expect(getOrganizations).toHaveBeenCalled();
  });

  test('Should set up addOrganization handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'organizations:addOrganization',
    );
    expect(handler).toBeDefined();

    const organization: Prisma.OrganizationCreateInput = {
      nickname: 'Test Organization',
      serverUrl: 'url',
      key: 'key',
    };

    handler && (await handler[1](event, organization));
    expect(addOrganization).toHaveBeenCalledWith(organization);
  });

  test('Should set up updateOrganization handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'organizations:updateOrganization',
    );
    expect(handler).toBeDefined();

    const id = 'orgId';
    const organization: Prisma.OrganizationUncheckedUpdateWithoutOrganizationCredentialsInput = {
      nickname: 'Updated Organization',
    };

    handler && (await handler[1](event, id, organization));
    expect(updateOrganization).toHaveBeenCalledWith(id, organization);
  });

  test('Should set up deleteOrganization handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'organizations:deleteOrganization',
    );
    expect(handler).toBeDefined();

    const id = 'orgId';

    handler && (await handler[1](event, id));
    expect(removeOrganization).toHaveBeenCalledWith(id);
  });
});
