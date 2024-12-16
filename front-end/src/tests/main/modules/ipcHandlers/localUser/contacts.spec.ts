import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerContactsHandlers from '@main/modules/ipcHandlers/localUser/contacts';
import {
  addContact,
  getOrganizationContacts,
  removeContact,
  updateContact,
} from '@main/services/localUser/contacts';
import { Prisma } from '@prisma/client';

vi.mock('@main/services/localUser/contacts', () => mockDeep());

describe('IPC handlers contacts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerContactsHandlers();
  });

  const userId = 'user1';
  const contactId = 'contact1';
  const organizationId = 'org1';
  const organizationUserIdOwner = 1;

  test('Should register handlers for each event', () => {
    const event = ['getOrganizationContacts', 'addContact', 'updateContact', 'removeContact'];
    expect(event.every(util => getIPCHandler(`contacts:${util}`))).toBe(true);
  });

  test('Should set up getOrganizationContacts handler', async () => {
    await invokeIPCHandler(
      'contacts:getOrganizationContacts',
      userId,
      organizationId,
      organizationUserIdOwner,
    );
    expect(getOrganizationContacts).toHaveBeenCalledWith(
      userId,
      organizationId,
      organizationUserIdOwner,
    );
  });

  test('Should set up addContact handler', async () => {
    const contact: Prisma.ContactUncheckedCreateInput = {
      id: 'contact1',
      user_id: 'user1',
      organization_id: 'org1',
      organization_user_id: 1,
      organization_user_id_owner: 3,
      nickname: '',
    };

    await invokeIPCHandler('contacts:addContact', contact);
    expect(addContact).toHaveBeenCalledWith(contact);
  });

  test('Should set up updateContact handler', async () => {
    const contact: Prisma.ContactUncheckedUpdateInput = {
      nickname: 'nickname',
    };

    await invokeIPCHandler('contacts:updateContact', contactId, userId, contact);
    expect(updateContact).toHaveBeenCalledWith(contactId, userId, contact);
  });

  test('Should set up removeContact handler', async () => {
    await invokeIPCHandler('contacts:removeContact', userId, contactId);
    expect(removeContact).toHaveBeenCalledWith(userId, contactId);
  });
});
