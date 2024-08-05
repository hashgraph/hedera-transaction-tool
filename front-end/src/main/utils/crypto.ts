import crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export function createCredentials(password: string) {
  let temp = bcrypt.hashSync(password, 10);

  const iv = temp.slice(0, 16);

  temp = bcrypt.hashSync(temp, 10);

  const key = temp.slice(8);

  return [key, iv];
}

export function encrypt(data, password: string) {
  data = Buffer.from(data, 'utf-8').toString('hex');

  const [key, iv] = createCredentials(password);

  const cipher = crypto.createCipheriv('aes-192-cbc', key, iv);

  const encrypted = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');

  return encrypted;
}

export function decrypt(data, password: string) {
  const [key, iv] = createCredentials(password);

  const decipher = crypto.createDecipheriv('aes-192-cbc', key, iv);

  const hex = decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');

  return Buffer.from(hex, 'hex').toString('utf-8');
}
