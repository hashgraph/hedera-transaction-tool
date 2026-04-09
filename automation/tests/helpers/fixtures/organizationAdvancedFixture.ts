import type { LoginPage } from '../../../pages/LoginPage.js';
import type { OrganizationPage, UserDetails } from '../../../pages/OrganizationPage.js';
import { disableNotificationsForUsers } from '../../../utils/db/databaseQueries.js';
import { createSeededOrganizationSession } from '../../../utils/seeding/organizationSeeding.js';

export interface OrganizationAdvancedFixture {
  localCredentials: {
    email: string;
    password: string;
  };
  firstUser: UserDetails;
  secondUser: UserDetails;
  thirdUser: UserDetails;
  complexKeyAccountId: string;
  secondaryComplexKeyAccountId: string | null;
}

export async function setupOrganizationAdvancedFixture(
  window: Parameters<typeof createSeededOrganizationSession>[0],
  loginPage: LoginPage,
  organizationPage: OrganizationPage,
  organizationNickname: string,
  createSecondaryComplexAccount = false,
): Promise<OrganizationAdvancedFixture> {
  organizationPage.complexAccountId = [];
  organizationPage.complexFileId = [];
  organizationPage.transactions = [];

  const seededSession = await createSeededOrganizationSession(
    window,
    loginPage,
    organizationPage,
    {
      userCount: 3,
      organizationNickname,
    },
  );

  const localCredentials = {
    email: seededSession.localUser.email,
    password: seededSession.localUser.password,
  };

  const firstUser = organizationPage.getUser(0);
  const secondUser = organizationPage.getUser(1);
  const thirdUser = organizationPage.getUser(2);
  await disableNotificationsForUsers([firstUser.email, secondUser.email, thirdUser.email]);

  await organizationPage.addComplexKeyAccountForTransactions(localCredentials.password);
  const complexKeyAccountId = organizationPage.getComplexAccountId();

  let secondaryComplexKeyAccountId: string | null = null;
  if (createSecondaryComplexAccount) {
    await organizationPage.addComplexKeyAccountForTransactions(localCredentials.password);
    secondaryComplexKeyAccountId = organizationPage.complexAccountId[1] ?? null;
  }

  return {
    localCredentials,
    firstUser,
    secondUser,
    thirdUser,
    complexKeyAccountId,
    secondaryComplexKeyAccountId,
  };
}
