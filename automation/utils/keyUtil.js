const crypto = require('crypto');

// Retrieves the private key from environment variables
function getPrivateKey() {
  return process.env.PRIVATE_KEY;
}

// Generates an ECDSA key pair
function generateECDSAKeyPair(curve = 'secp256k1') {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: curve,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der',
    },
  });

  return privateKey.toString('hex');
}

// Generates an Ed25519 key pair
function generateEd25519KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: {
      type: 'spki',
      format: 'der',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der',
    },
  });

  return privateKey.toString('hex');
}

module.exports = {
  getPrivateKey,
  generateECDSAKeyPair,
  generateEd25519KeyPair,
};
