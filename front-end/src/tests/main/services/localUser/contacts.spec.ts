import { expect, vi } from 'vitest';

import { Contact } from '@prisma/client';

import prisma from '@main/db/__mocks__/prisma';

import {
  addContact,
  getOrganizationContacts,
  removeContact,
  updateContact,
} from '@main/services/localUser/contacts';

vi.mock('crypto', () => ({ randomUUID: vi.fn() }));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('@main/db/prisma');

describe('Services Local User Contacts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const contact: Contact = {
    id: '321',
    user_id: '123',
    organization_user_id_owner: 1,
    organization_user_id: 333,
    organization_id: 'someOrgId',
    nickname: 'Peter',
  };

  describe('getOrganizationContacts', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return contacts for the given parameters', async () => {
      prisma.contact.findMany.mockResolvedValueOnce([contact]);

      const result = await getOrganizationContacts(
        contact.user_id,
        contact.organization_id,
        contact.organization_user_id_owner,
      );

      expect(result).toStrictEqual([contact]);
    });

    test('Should return an empty array if an error occurs', async () => {
      prisma.contact.findMany.mockRejectedValue(new Error('Test error'));

      const result = await getOrganizationContacts(
        contact.user_id,
        contact.organization_id,
        contact.organization_user_id_owner,
      );

      expect(result).toEqual([]);
    });
  });

  describe('addContact', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should add a new contact and return it', async () => {
      prisma.contact.create.mockResolvedValue(contact);

      const result = await addContact(contact);

      expect(result).toEqual(contact);
    });
  });

  describe('updateContact', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should call the prisma updateMany with the correct parameters', async () => {
      await updateContact('1', 'user1', contact);

      expect(prisma.contact.updateMany).toHaveBeenCalledWith({
        where: { id: '1', user_id: 'user1' },
        data: { ...contact, user_id: 'user1' },
      });
    });
  });

  describe('removeContact', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should remove the contact with the given id and user id', async () => {
      await removeContact('user1', '1');

      expect(prisma.contact.deleteMany).toHaveBeenCalledWith({
        where: { id: '1', user_id: 'user1' },
      });
    });
  });
});
