import { STATIC_USER, USE_KEYCHAIN } from '@shared/constants';
import { getPrismaClient } from '@main/db/prisma';
import { hash } from '@main/utils/crypto';

/* Only this initialization path may create the protected mode claim. */
export const initializeUseKeychain = async (useKeychain: boolean): Promise<void> => {
  if (typeof useKeychain !== 'boolean') throw new Error('Keychain mode must be a boolean');

  const password = await hash(STATIC_USER);
  await getPrismaClient().$transaction(async prisma => {
    // This will also recover from of a static user left behind by interrupted setup.
    const user = await prisma.user.upsert({
      where: { email: STATIC_USER },
      create: { email: STATIC_USER, password },
      update: {},
    });
    const existing = await prisma.claim.findUnique({
      where: { user_id_claim_key: { user_id: user.id, claim_key: USE_KEYCHAIN } },
    });
    if (existing) throw new Error('Keychain mode already initialized');
    await prisma.claim.create({
      data: { user_id: user.id, claim_key: USE_KEYCHAIN, claim_value: String(useKeychain) },
    });
  });
};
