const crypto = require('crypto');
const { proto } = require('@hashgraph/proto');
const { PublicKey, KeyList, Key } = require('@hashgraph/sdk');
const bip39 = require('bip39');

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

const decodeProtobuffKey = protobuffEncodedKey => {
  const buffer = Buffer.from(protobuffEncodedKey, 'hex');
  const protoKey = proto.Key.decode(buffer);
  return Key._fromProtobufKey(protoKey);
};

const flattenKeyList = keyList => {
  if (keyList instanceof PublicKey) {
    return [keyList];
  }

  if (!(keyList instanceof KeyList)) {
    throw new Error('Provided key is not a KeyList');
  }

  const keys = [];
  if (Array.isArray(keyList._keys)) {
    keyList._keys.forEach(key => {
      if (key instanceof PublicKey) {
        keys.push(key);
      } else if (key instanceof KeyList) {
        keys.push(...flattenKeyList(key));
      }
    });
  } else {
    console.error("KeyList does not have a 'keys' property or it's not an array", keyList);
    throw new Error('KeyList is malformed');
  }

  return keys;
};

const decodeAndFlattenKeys = protobuffEncodedKey => {
  try {
    const decodedKey = decodeProtobuffKey(protobuffEncodedKey);

    const flatKeys = flattenKeyList(decodedKey);

    return flatKeys.map(key => key.toString());
  } catch (error) {
    console.error('Error decoding and flattening keys:', error);
    return [];
  }
};

// Generates a 24-word seed mnemonic phrase
function generateMnemonic() {
  return bip39.generateMnemonic(256);
}

module.exports = {
  getPrivateKey,
  generateECDSAKeyPair,
  generateEd25519KeyPair,
  decodeAndFlattenKeys,
  generateMnemonic,
};
