import Store, { Schema } from 'electron-store';

import { encrypt, decrypt } from '../../utils/crypto';

import { IKeyPair, IStoredSecretHash, storedSecretHashJSONSchema } from '../../shared/interfaces';

type SchemaProperties = {
  localKeys: IStoredSecretHash[];
  organizationKeys: {
    organizationServerUrl: string;
    users: {
      userId: string;
      secretHashes: IStoredSecretHash[];
    }[];
  }[];
};

/* Persisting key pairs per organization in a JSON file */
export default function getLocalUserKeysStore(email: string) {
  const schema: Schema<SchemaProperties> = {
    localKeys: {
      type: 'array',
      items: storedSecretHashJSONSchema,
      default: [],
    },
    organizationKeys: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          organizationServerUrl: {
            type: 'string',
          },
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                userId: {
                  type: 'string',
                },
                secretHashes: {
                  type: 'array',
                  items: storedSecretHashJSONSchema,
                  default: [],
                },
              },
            },
          },
        },
      },
      default: [],
    },
  };

  const store = new Store({
    schema,
    cwd: `${email}`,
    name: `${email}-keys`,
    clearInvalidConfig: true,
  });

  return store;
}

//Get all stored secret hash objects
export const getStoredSecretHashes = async (
  email: string,
  serverUrl?: string,
  userId?: string,
): Promise<IStoredSecretHash[]> => {
  const store = getLocalUserKeysStore(email);

  try {
    const organizationKeys = store.get('organizationKeys');

    if (serverUrl) {
      const organizationData = organizationKeys.find(
        org => org.organizationServerUrl === serverUrl,
      );

      if (!organizationData) {
        return [];
      }

      if (userId) {
        return organizationData?.users.find(u => u.userId === userId)?.secretHashes || [];
      }

      return organizationData?.users.map(u => u.secretHashes).flat() || [];
    } else {
      return store
        .get('localKeys')
        .concat(organizationKeys.map(org => org.users.map(u => u.secretHashes).flat()).flat());
    }
  } catch (error: any) {
    store.clear();
    return [];
  }
};

//Get stored key pairs
export const getStoredKeyPairs = async (
  email: string,
  serverUrl?: string,
  userId?: string,
  secretHash?: string,
  secretHashName?: string,
): Promise<IKeyPair[]> => {
  const storedSecretHashes = await getStoredSecretHashes(email, serverUrl, userId);

  let keyPairs: IKeyPair[] = [];

  if (secretHashName) {
    storedSecretHashes.forEach(sh => {
      if (sh.name === secretHashName) {
        keyPairs = keyPairs.concat(sh.keyPairs);
      }
    });
  } else if (secretHash) {
    storedSecretHashes.forEach(sh => {
      if (sh.secretHash === secretHash) {
        keyPairs = keyPairs.concat(sh.keyPairs);
      }
    });
  } else {
    keyPairs = storedSecretHashes.map(orgSh => orgSh.keyPairs).flat();
  }

  return keyPairs;
};

// Get secret hashes of currently saved keys
export const getStoredKeysSecretHashes = async (
  email: string,
  serverUrl?: string,
  userId?: string,
): Promise<string[]> => {
  const storedSecretHashes = await getStoredSecretHashes(email, serverUrl, userId);

  return storedSecretHashes.map(orgSh => orgSh.secretHash);
};

// Store key pair
export const storeKeyPair = async (
  email: string,
  password: string,
  secretHash: string,
  keyPair: IKeyPair,
  serverUrl?: string,
  userId?: string,
) => {
  try {
    const store = getLocalUserKeysStore(email);
    keyPair.privateKey = await encrypt(keyPair.privateKey, password);

    console.log(email);

    if (serverUrl) {
      if (!userId) {
        throw new Error('User id not provided');
      }

      const organizationData = store.store.organizationKeys.find(
        orgSh => orgSh.organizationServerUrl === serverUrl,
      );

      console.log(organizationData);

      if (!organizationData) {
        store.store.organizationKeys.push({
          organizationServerUrl: serverUrl,
          users: [
            {
              userId,
              secretHashes: [
                {
                  secretHash: secretHash,
                  keyPairs: [keyPair],
                },
              ],
            },
          ],
        });

        return;
      }

      const storedUser = organizationData.users.find(u => u.userId === userId);

      if (!storedUser) {
        organizationData.users.push({
          userId,
          secretHashes: [{ secretHash, keyPairs: [keyPair] }],
        });
      } else {
        const storedSecretHash = storedUser?.secretHashes.find(sh => sh.secretHash === secretHash);

        if (storedSecretHash) {
          const s_keyPair = storedSecretHash.keyPairs.find(
            kp => kp.publicKey === keyPair.publicKey,
          );

          if (s_keyPair) {
            s_keyPair.privateKey = keyPair.privateKey;
          } else {
            storedSecretHash.keyPairs.push(keyPair);
          }
        } else {
          storedUser.secretHashes.push({ secretHash, keyPairs: [keyPair] });
        }
      }
    } else {
      const localSecretHash = store.store.localKeys.find(sh => sh.secretHash === secretHash);
      console.log(localSecretHash);

      if (localSecretHash) {
        const s_keyPair = localSecretHash.keyPairs.find(kp => kp.publicKey === keyPair.publicKey);

        if (s_keyPair) {
          s_keyPair.privateKey = keyPair.privateKey;
        } else {
          localSecretHash.keyPairs.push(keyPair);
        }
      } else {
        store.set('localKeys', [
          ...store.store.localKeys,
          { secretHash: secretHash, keyPairs: [keyPair] },
        ]);
      }
    }
  } catch (error: any) {
    console.log(error);
    throw new Error(error.message || 'Failed to store key pair');
  }
};

// Change decryption password
export const changeDecryptionPassword = async (
  email: string,
  oldPassword: string,
  newPassword: string,
) => {
  const store = getLocalUserKeysStore(email);

  store.store.localKeys.forEach(sh => {
    sh.keyPairs = sh.keyPairs.map(kp => {
      const decryptedPrivateKey = decrypt(kp.privateKey, oldPassword);
      const encryptedPrivateKey = encrypt(decryptedPrivateKey, newPassword);

      return { ...kp, privateKey: encryptedPrivateKey };
    });
  });

  store.store.organizationKeys.forEach(org => {
    org.users.forEach(u => {
      u.secretHashes.forEach(sh => {
        sh.keyPairs = sh.keyPairs.map(kp => {
          const decryptedPrivateKey = decrypt(kp.privateKey, oldPassword);
          const encryptedPrivateKey = encrypt(decryptedPrivateKey, newPassword);

          return { ...kp, privateKey: encryptedPrivateKey };
        });
      });
    });
  });

  return getStoredSecretHashes(email);
};

// Decrypt user's private key
export const decryptPrivateKey = async (email: string, password: string, publicKey: string) => {
  const keyPairs = await getStoredKeyPairs(email);

  const searchedKeyPair = keyPairs.find(kp => kp.publicKey === publicKey);

  const decryptedPrivateKey = decrypt(searchedKeyPair?.privateKey, password);

  return decryptedPrivateKey;
};

// Delete encrypted private keys
export const deleteEncryptedPrivateKeys = async (
  email: string,
  serverUrl: string,
  userId: string,
) => {
  const store = getLocalUserKeysStore(email);

  store.store.localKeys.forEach(sh => {
    sh.keyPairs.forEach(kp => {
      kp.privateKey = '';
    });
  });

  store.store.organizationKeys
    .find(org => org.organizationServerUrl === serverUrl)
    ?.users.find(u => u.userId === userId)
    ?.secretHashes?.forEach(sh => {
      sh.keyPairs.forEach(kp => {
        kp.privateKey = '';
      });
    });
};

// Clear user's keys
export const deleteSecretHashes = (email: string, serverUrl?: string, userId?: string) => {
  const store = getLocalUserKeysStore(email);

  if (serverUrl) {
    const organization = store.store.organizationKeys.find(
      org => org.organizationServerUrl === serverUrl,
    );

    if (organization) {
      const user = organization?.users.find(u => u.userId === userId);

      if (userId && user) {
        user.secretHashes = [];
      } else {
        organization.users = [];
      }
    }
  } else {
    store.clear();
  }
};
