import { randomBytes, randomInt } from 'node:crypto';

export const generateRandomEmail = (domain = 'test.com') => {
  const randomPart = randomBytes(3).toString('hex');
  return `${randomPart}@${domain}`;
};

export const generateRandomPassword = (length = 10) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    result += characters.charAt(randomInt(0, charactersLength));
  }

  return result;
};
