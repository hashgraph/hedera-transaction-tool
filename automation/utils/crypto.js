const crypto = require('node:crypto');

function hash(data) {
  return crypto.createHash('sha256').update(data).digest();
}

function createCredentials(password) {
  let temp = hash(password);

  const iv = temp.subarray(0, 16);

  temp = hash(temp);

  const key = temp.subarray(0, 24);

  return [key, iv];
}

function encrypt(data, password) {
  data = Buffer.from(data, 'utf-8').toString('hex');

  const [key, iv] = createCredentials(password);

  const cipher = crypto.createCipheriv('aes-192-cbc', key, iv);

  return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}

function decrypt(data, password) {
  const [key, iv] = createCredentials(password);

  const decipher = crypto.createDecipheriv('aes-192-cbc', key, iv);

  const hex = decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');

  return Buffer.from(hex, 'hex').toString('utf-8');
}

module.exports = { encrypt, decrypt };
