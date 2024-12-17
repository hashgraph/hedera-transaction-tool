import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerOrganizationsHandlers from '@main/modules/ipcHandlers/localUser/organizations';
import {
  getOrganizations,
  addOrganization,
  updateOrganization,
  removeOrganization,
} from '@main/services/localUser';
import { Prisma } from '@prisma/client';

vi.mock('@main/services/localUser', () => mockDeep());

describe('IPC handlers organizations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerOrganizationsHandlers();
  });

  const id = 'orgId';

  test('Should register handlers for each event', () => {
    const event = [
      'getOrganizations',
      'addOrganization',
      'updateOrganization',
      'deleteOrganization',
    ];
    expect(event.every(util => getIPCHandler(`organizations:${util}`))).toBe(true);
  });

  test('Should set up getOrganizations handler', async () => {
    await invokeIPCHandler('organizations:getOrganizations');
    expect(getOrganizations).toHaveBeenCalled();
  });

  test('Should set up addOrganization handler', async () => {
    const organization: Prisma.OrganizationCreateInput = {
      nickname: 'Test Organization',
      serverUrl: 'url',
      key: 'key',
    };

    await invokeIPCHandler('organizations:addOrganization', organization);
    expect(addOrganization).toHaveBeenCalledWith(organization);
  });

  test('Should set up updateOrganization handler', async () => {
    const organization: Prisma.OrganizationUncheckedUpdateWithoutOrganizationCredentialsInput = {
      nickname: 'Updated Organization',
    };

    await invokeIPCHandler('organizations:updateOrganization', id, organization);
    expect(updateOrganization).toHaveBeenCalledWith(id, organization);
  });

  test('Should set up deleteOrganization handler', async () => {
    await invokeIPCHandler('organizations:deleteOrganization', id);
    expect(removeOrganization).toHaveBeenCalledWith(id);
  });
});
