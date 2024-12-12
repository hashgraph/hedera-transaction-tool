import crypto from 'crypto';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';

export function deriveKey(password: string, salt: Buffer) {
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

export function decrypt(data: string, password: string) {
  const bData = Buffer.from(data, 'base64');

  const salt = bData.subarray(0, 64);
  const iv = bData.subarray(64, 80);
  const tag = bData.subarray(80, 96);
  const text = bData.subarray(96).toString('base64');

  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = decipher.update(text, 'base64', 'utf8') + decipher.final('utf8');

  return decrypted;
}

export async function hash(data: string, usePseudoSalt = false): Promise<string> {
  const pseudoSalt = Buffer.from(data.slice(0, 16));
  return await argon2.hash(data, {
    salt: usePseudoSalt ? pseudoSalt : undefined,
  });
}

export async function verifyHash(hash: string, data: string): Promise<boolean> {
  return await argon2.verify(hash, data);
}

export async function dualCompareHash(data: string, hash: string) {
  const matchBcrypt = await bcrypt.compare(data, hash);
  const matchArgon2 = await verifyHash(hash, data);

  return matchBcrypt || matchArgon2;
}
