import { expect, vi } from 'vitest';

import prisma from '@main/db/__mocks__/prisma';

import {
  getOrganization,
  getOrganizations,
  addOrganization,
  removeOrganization,
  updateOrganization,
} from '@main/services/localUser/organizations';

vi.mock('crypto', () => ({ randomUUID: vi.fn() }));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('@main/db/prisma');

describe('Services Local User Organizations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getOrganizations', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should call prisma find many for organizations', async () => {
      await getOrganizations();

      expect(prisma.organization.findMany).toHaveBeenCalledOnce();
    });

    test('Should return an empty array if an error occurs', async () => {
      prisma.organization.findMany.mockRejectedValue(
        new Error('Organizations find many database error'),
      );

      const result = await getOrganizations();

      expect(result).toEqual([]);
    });
  });

  describe('getOrganization', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should call prisma find first for organizations with correct params', async () => {
      const id = '1';

      await getOrganization(id);

      expect(prisma.organization.findFirst).toHaveBeenCalledWith({ where: { id: id } });
    });

    test('Should return an null if an error occurs', async () => {
      const id = '1';

      prisma.organization.findFirst.mockRejectedValue(
        new Error('Organizations find first database error'),
      );

      const result = await getOrganization(id);

      expect(result).toEqual(null);
    });
  });

  describe('addOrganization', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should add a new organization if it does not exist', async () => {
      const organization = {
        serverUrl: 'http://example.com',
        nickname: 'Example',
        key: 'key',
      };

      prisma.organization.count.mockResolvedValue(0);

      await addOrganization(organization);

      expect(prisma.organization.create).toHaveBeenCalledWith({ data: organization });
    });

    test('Should throw an error if the organization with such server url already exists', async () => {
      const organization = {
        serverUrl: 'http://example.com',
        nickname: 'Example',
        key: 'key',
      };

      prisma.organization.count.mockResolvedValueOnce(1);

      await expect(addOrganization(organization)).rejects.toThrow(
        'Organization with this server URL already exists',
      );
      expect(prisma.organization.count).toHaveBeenCalledWith({
        where: { serverUrl: organization.serverUrl },
      });
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });

    test('Should throw an error if the organization with such nickname url already exists', async () => {
      const organization = {
        serverUrl: 'http://example.com',
        nickname: 'Example',
        key: 'key',
      };

      prisma.organization.count.mockResolvedValueOnce(0);
      prisma.organization.count.mockResolvedValueOnce(1);

      await expect(addOrganization(organization)).rejects.toThrow(
        'Organization with this nickname already exists',
      );
      expect(prisma.organization.count).toHaveBeenCalledWith({
        where: { serverUrl: organization.serverUrl },
      });
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });
  });

  describe('removeOrganization', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should remove an organization and its related data', async () => {
      const id = 'org1';

      await removeOrganization(id);

      expect(prisma.keyPair.deleteMany).toHaveBeenCalledWith({ where: { organization_id: id } });
      expect(prisma.contact.deleteMany).toHaveBeenCalledWith({ where: { organization_id: id } });
      expect(prisma.organizationCredentials.deleteMany).toHaveBeenCalledWith({
        where: { organization_id: id },
      });
      expect(prisma.organization.delete).toHaveBeenCalledWith({ where: { id } });
    });
  });

  describe('updateOrganization', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should call prisma updateMany with correct params', async () => {
      const id = 'org1';
      const data = {
        nickname: 'Example',
        serverUrl: 'http://example.com',
        key: 'key1',
      };

      await updateOrganization(id, data);

      expect(prisma.organization.updateMany).toHaveBeenCalledWith({
        where: { id },
        data,
      });
    });
  });
});
