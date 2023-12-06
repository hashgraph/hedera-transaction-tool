import crypto from 'crypto';

export function hash(data) {
  return crypto.createHash('sha256').update(data).digest();
}

export function createCredentials(password: string) {
  let temp = hash(password);

  const iv = temp.slice(0, 16);

  temp = hash(temp);

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

  const hex = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8');

  return Buffer.from(hex, 'hex').toString('utf-8');
}
