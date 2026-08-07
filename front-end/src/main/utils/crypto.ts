import crypto from 'crypto';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';

export const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_LEGACY_ITERATIONS = 2_560;
const KEY_LENGTH = 32;
const BLOB_V2_PREFIX = 'v2:';

async function deriveKey(password: string, salt: Buffer, iterations: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, KEY_LENGTH, 'sha512', (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

function parseBlobParts(blob: string) {
  const bData = Buffer.from(blob, 'base64');
  return {
    salt: bData.subarray(0, 64),
    iv: bData.subarray(64, 80),
    tag: bData.subarray(80, 96),
    text: bData.subarray(96).toString('base64'),
  };
}

export function isLegacyBlob(data: string) {
  return !data.startsWith(BLOB_V2_PREFIX);
}

export async function encrypt(data: string, password: string): Promise<string> {
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(64);

  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);

  const tag = cipher.getAuthTag();

  return BLOB_V2_PREFIX + Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

export async function decrypt(data: string, password: string): Promise<string> {
  const isLegacy = isLegacyBlob(data);
  const blob = isLegacy ? data : data.slice(BLOB_V2_PREFIX.length);
  const iterations = isLegacy ? PBKDF2_LEGACY_ITERATIONS : PBKDF2_ITERATIONS;

  const { salt, iv, tag, text } = parseBlobParts(blob);

  const key = await deriveKey(password, salt, iterations);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(text, 'base64', 'utf8') + decipher.final('utf8');
}

export async function hash(data: string, usePseudoSalt = false): Promise<string> {
  let pseudoSalt: Buffer | undefined;
  if (usePseudoSalt) {
    const paddedData = data.padEnd(16, 'x');
    pseudoSalt = Buffer.from(paddedData.slice(0, 16));
  }
  return await argon2.hash(data, {
    salt: pseudoSalt,
  });
}

export async function verifyHash(hash: string, data: string): Promise<boolean> {
  return await argon2.verify(hash, data);
}

export async function dualCompareHash(data: string, hash: string) {
  const matchBcrypt = await bcrypt.compare(data, hash);
  const matchArgon2 = await verifyHash(hash, data);

  return { correct: matchBcrypt || matchArgon2, isBcrypt: matchBcrypt };
}
