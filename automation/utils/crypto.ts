import * as crypto from 'crypto';
import * as argon2 from 'argon2';

function deriveKey(password: crypto.BinaryLike, salt: crypto.BinaryLike) {
  const iterations = 2560;
  const keyLength = 32;

  return crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha512');
}

export function encrypt(data: string, password: string) {
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(64);

  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

export function decrypt(data:string, password: string) {
  const bData = Buffer.from(data, 'base64');

  const salt = bData.subarray(0, 64);
  const iv = bData.subarray(64, 80);
  const tag = bData.subarray(80, 96);
  const text = bData.subarray(96).toString('base64');

  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(text, 'base64', 'utf8') + decipher.final('utf8');
}

export async function argonHash(data:string, usePseudoSalt = false) {
  let pseudoSalt;
  if (usePseudoSalt) {
    const paddedData = data.padEnd(16, 'x');
    pseudoSalt = Buffer.from(paddedData.slice(0, 16));
  }

  return await argon2.hash(data, {
    salt: pseudoSalt,
  });
}
