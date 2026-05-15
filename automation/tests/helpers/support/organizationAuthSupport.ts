import type { OrganizationPage, UserDetails } from '../../../pages/OrganizationPage.js';

export async function signInOrganizationUser(
  organizationPage: OrganizationPage,
  user: Pick<UserDetails, 'email' | 'password'>,
  encryptionPassword: string,
) {
  await organizationPage.signInOrganization(user.email, user.password, encryptionPassword);
}
