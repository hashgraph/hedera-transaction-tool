const crypto = require('node:crypto');

function deriveKey(password, salt) {
  const iterations = 2560;
  const keyLength = 32;

  return crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha512');
}

function encrypt(data, password) {
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(64);

  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

function decrypt(data, password) {
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

module.exports = { encrypt, decrypt };
