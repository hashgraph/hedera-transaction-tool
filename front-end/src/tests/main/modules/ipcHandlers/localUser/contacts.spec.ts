import { ipcMain } from 'electron';

import registerContactsHandlers from '@main/modules/ipcHandlers/localUser/contacts';
import {
  addContact,
  getOrganizationContacts,
  removeContact,
  updateContact,
} from '@main/services/localUser/contacts';
import { Prisma } from '@prisma/client';
import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser/contacts', () => ({
  addContact: vi.fn(),
  getOrganizationContacts: vi.fn(),
  removeContact: vi.fn(),
  updateContact: vi.fn(),
}));

describe('IPC handlers contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerContactsHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const event = ['getOrganizationContacts', 'addContact', 'updateContact', 'removeContact'];

    expect(
      event.every(util =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `contacts:${util}`),
      ),
    ).toBe(true);
  });

  test('Should set up getOrganizationContacts handler', async () => {
    const getOrgContactsHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'contacts:getOrganizationContacts',
    );
    expect(getOrgContactsHandler).toBeDefined();

    const userId = 'user1';
    const organizationId = 'org1';
    const organizationUserIdOwner = 1;

    getOrgContactsHandler &&
      (await getOrgContactsHandler[1](event, userId, organizationId, organizationUserIdOwner));
    expect(getOrganizationContacts).toHaveBeenCalledWith(
      userId,
      organizationId,
      organizationUserIdOwner,
    );
  });

  test('Should set up addContact handler', async () => {
    const addContactHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'contacts:addContact',
    );
    expect(addContactHandler).toBeDefined();

    const contact: Prisma.ContactUncheckedCreateInput = {
      id: 'contact1',
      user_id: 'user1',
      organization_id: 'org1',
      organization_user_id: 1,
      organization_user_id_owner: 3,
      nickname: '',
    };

    addContactHandler && (await addContactHandler[1](event, contact));
    expect(addContact).toHaveBeenCalledWith(contact);
  });

  test('Should set up updateContact handler', async () => {
    const updateContactHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'contacts:updateContact',
    );
    expect(updateContactHandler).toBeDefined();

    const contactId = 'contact1';
    const userId = 'user1';
    const contact: Prisma.ContactUncheckedUpdateInput = {
      // fill in fields as necessary
      nickname: 'nickname',
    };

    updateContactHandler && (await updateContactHandler[1](event, contactId, userId, contact));
    expect(updateContact).toHaveBeenCalledWith(contactId, userId, contact);
  });

  test('Should set up removeContact handler', async () => {
    const removeContactHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'contacts:removeContact',
    );
    expect(removeContactHandler).toBeDefined();

    const userId = 'user1';
    const contactId = 'contact1';

    removeContactHandler && (await removeContactHandler[1](event, userId, contactId));
    expect(removeContact).toHaveBeenCalledWith(userId, contactId);
  });
});
