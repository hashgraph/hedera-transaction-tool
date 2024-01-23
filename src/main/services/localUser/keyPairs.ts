import { getUserStorageFolderPath } from '.';

import Store, { Schema } from 'electron-store';

import { encrypt, decrypt } from '../../utils/crypto';

import {
  IKeyPair,
  IStoredSecretHash,
  keyPairJSONSchema,
  storedSecretHashJSONSchema,
} from '../../shared/interfaces';

type SchemaProperties = {
  localKeys: IStoredSecretHash[];
  localExternalKeys: IKeyPair[];
  organizationKeys: {
    organizationServerUrl: string;
    userId: string;
    secretHashes: IStoredSecretHash[];
    externalKeys: IKeyPair[];
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
    localExternalKeys: {
      type: 'array',
      items: keyPairJSONSchema,
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
          userId: {
            type: 'string',
          },
          secretHashes: {
            type: 'array',
            items: storedSecretHashJSONSchema,
            default: [],
          },
          externalKeys: {
            type: 'array',
            items: keyPairJSONSchema,
            default: [],
          },
        },
      },
      default: [],
    },
  };

  const store = new Store({
    schema,
    cwd: getUserStorageFolderPath(email),
    name: `keys`,
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
      const organizationUsers = organizationKeys.filter(
        org => org.organizationServerUrl === serverUrl,
      );

      if (userId) {
        return organizationUsers.find(u => u.userId === userId)?.secretHashes || [];
      }

      return organizationUsers.map(u => u.secretHashes).flat() || [];
    } else {
      return store
        .get('localKeys')
        .concat(organizationKeys.map(org => org.secretHashes.flat()).flat());
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

  const store = getLocalUserKeysStore(email);

  try {
    const organizationKeys = store.get('organizationKeys');

    if (serverUrl) {
      const organizationUsers = organizationKeys.filter(
        org => org.organizationServerUrl === serverUrl,
      );

      if (userId) {
        keyPairs = keyPairs.concat(
          organizationUsers.find(u => u.userId === userId)?.externalKeys || [],
        );
      }

      keyPairs = keyPairs.concat(organizationUsers.map(u => u.externalKeys).flat() || []);
    } else {
      keyPairs = keyPairs.concat(store.get('localExternalKeys'));
    }
  } catch (error: any) {
    store.clear();
    return [];
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
  keyPair: IKeyPair,
  secretHash?: string,
  serverUrl?: string,
  userId?: string,
) => {
  try {
    const store = getLocalUserKeysStore(email);
    keyPair.privateKey = encrypt(keyPair.privateKey, password);

    if (serverUrl) {
      if (!userId) {
        throw new Error('User id not provided');
      }

      const organizationsKeys = store.get('organizationKeys');

      const organizationUsers = organizationsKeys.filter(
        orgSh => orgSh.organizationServerUrl === serverUrl,
      );

      if (organizationUsers.length === 0) {
        if (secretHash) {
          store.set('organizationKeys', [
            ...organizationsKeys,
            {
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
                  externalKeys: [],
                },
              ],
            },
          ]);
        } else {
          store.set('organizationKeys', [
            ...organizationsKeys,
            {
              organizationServerUrl: serverUrl,
              users: [
                {
                  userId,
                  externalKeys: [keyPair],
                  secretHashes: [],
                },
              ],
            },
          ]);
        }

        return;
      }

      const storedUser = organizationUsers.find(u => u.userId === userId);

      if (!storedUser) {
        if (secretHash) {
          organizationUsers.push({
            organizationServerUrl: serverUrl,
            userId,
            secretHashes: [{ secretHash, keyPairs: [keyPair] }],
            externalKeys: [],
          });
        } else {
          organizationUsers.push({
            organizationServerUrl: serverUrl,
            userId,
            externalKeys: [keyPair],
            secretHashes: [],
          });
        }
      } else {
        if (secretHash) {
          const storedSecretHash = storedUser.secretHashes.find(sh => sh.secretHash === secretHash);

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
        } else {
          const s_keyPair = storedUser.externalKeys.find(kp => kp.publicKey === keyPair.publicKey);

          if (s_keyPair) {
            s_keyPair.privateKey = keyPair.privateKey;
          } else {
            storedUser.externalKeys.push(keyPair);
          }
        }
      }

      store.set('organizationKeys', [
        ...organizationsKeys.filter(orgSh => orgSh.organizationServerUrl !== serverUrl),
        ...organizationUsers,
      ]);
    } else {
      if (secretHash) {
        const localKeys = store.get('localKeys');

        const localSecretHash = localKeys.find(sh => sh.secretHash === secretHash);

        if (localSecretHash) {
          const s_keyPair = localSecretHash.keyPairs.find(kp => kp.publicKey === keyPair.publicKey);

          if (s_keyPair) {
            s_keyPair.privateKey = keyPair.privateKey;
          } else {
            localSecretHash.keyPairs.push(keyPair);
          }

          store.set('localKeys', localKeys);
        } else {
          store.set('localKeys', [
            ...store.store.localKeys,
            { secretHash: secretHash, keyPairs: [keyPair] },
          ]);
        }
      } else {
        const localExternalKeys = store.get('localExternalKeys');

        const s_keyPair = localExternalKeys.find(kp => kp.publicKey === keyPair.publicKey);

        if (s_keyPair) {
          s_keyPair.privateKey = keyPair.privateKey;
        } else {
          localExternalKeys.push(keyPair);
        }

        store.set('localExternalKeys', localExternalKeys);
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

  store.set(
    'localKeys',
    store.store.localKeys.map(sh => {
      sh.keyPairs = sh.keyPairs.map(kp => {
        const decryptedPrivateKey = decrypt(kp.privateKey, oldPassword);
        const encryptedPrivateKey = encrypt(decryptedPrivateKey, newPassword);

        return { ...kp, privateKey: encryptedPrivateKey };
      });

      return sh;
    }),
  );

  store.set(
    'localExternalKeys',
    store.store.localExternalKeys.map(kp => {
      const decryptedPrivateKey = decrypt(kp.privateKey, oldPassword);
      const encryptedPrivateKey = encrypt(decryptedPrivateKey, newPassword);

      return { ...kp, privateKey: encryptedPrivateKey };
    }),
  );

  store.set(
    'organizationKeys',
    store.store.organizationKeys.map(user => {
      user.secretHashes = user.secretHashes.map(sh => {
        sh.keyPairs = sh.keyPairs.map(kp => {
          const decryptedPrivateKey = decrypt(kp.privateKey, oldPassword);
          const encryptedPrivateKey = encrypt(decryptedPrivateKey, newPassword);

          return { ...kp, privateKey: encryptedPrivateKey };
        });

        return sh;
      });

      user.externalKeys = user.externalKeys.map(kp => {
        const decryptedPrivateKey = decrypt(kp.privateKey, oldPassword);
        const encryptedPrivateKey = encrypt(decryptedPrivateKey, newPassword);

        return { ...kp, privateKey: encryptedPrivateKey };
      });

      return user;
    }),
  );

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

  const newLocalKeys = store.get('localKeys').map(sh => {
    sh.keyPairs.forEach(kp => {
      kp.privateKey = '';
    });
  });
  store.set('localKeys', newLocalKeys);

  const newExternalLocalKeys = store.get('localExternalKeys').map(kp => {
    return { ...kp, privateKey: '' };
  });
  store.set('localKeys', newExternalLocalKeys);

  const newOrganizationKeys = store.get('organizationKeys').map(user => {
    if (user.organizationServerUrl === serverUrl && user.userId === userId) {
      user.secretHashes?.forEach(sh => {
        sh.keyPairs.forEach(kp => {
          kp.privateKey = '';
        });
      });

      user.externalKeys?.forEach(kp => {
        kp.privateKey = '';
      });
    }

    return user;
  });

  store.set('organizationKeys', newOrganizationKeys);
};

// Clear user's keys
export const deleteSecretHashes = (email: string, serverUrl?: string, userId?: string) => {
  const store = getLocalUserKeysStore(email);

  if (serverUrl) {
    let organizationKeys = store.get('organizationKeys');

    const organization = organizationKeys.filter(org => org.organizationServerUrl === serverUrl);

    if (organization) {
      const user = organization.find(u => u.userId === userId);

      if (userId && user) {
        user.secretHashes = [];
      } else {
        organizationKeys = organizationKeys.filter(u => u.organizationServerUrl !== serverUrl);
      }
    }

    store.set('organizationKeys', organizationKeys);
  } else {
    store.clear();
  }
};
