import { getPrismaClient } from '@main/db';

export const getContactPublicKeys = async (contactId: string) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.contactPublicKey.findMany({
      where: {
        contact_id: contactId,
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const createContactPublicKey = async (publicKey: string, contactId: string) => {
  const prisma = getPrismaClient();

  const publicKeys = await getContactPublicKeys(contactId);

  if (publicKeys.some(pk => pk.public_key === publicKey)) {
    throw new Error('Public Key already exists!');
  }

  await prisma.contactPublicKey.create({
    data: {
      public_key: publicKey,
      contact_id: contactId,
    },
  });
};
