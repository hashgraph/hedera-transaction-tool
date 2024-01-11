import fs from 'fs/promises';

import Store, { Schema } from 'electron-store';

import { hash } from '../../utils/crypto';

type SchemaProperties = {
  email: string;
  passwordHash: string;
  organizationCredentials: { serverUrl: string; email: string; encryptedPassword: string }[];
};

/* persisting accounts data in a JSON file */
export default function getLocalUserAuthStore(email: string) {
  const schema: Schema<SchemaProperties> = {
    email: { type: 'string' },
    passwordHash: { type: 'string' },
    organizationCredentials: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          serverUrl: {
            type: 'string',
          },
          email: {
            type: 'string',
          },
          encryptedPassword: {
            type: 'string',
          },
        },
      },
      default: [],
    },
  };

  const store = new Store({
    schema,
    cwd: `${email}`,
    name: `${email}-auth`,
    clearInvalidConfig: true,
  });

  return store;
}

export const register = (email: string, password: string) => {
  const store = getLocalUserAuthStore(email);

  store.set('email', email);
  const passwordHash = hash(password).toString('hex');
  store.set('passwordHash', passwordHash);
};

export const login = async (email: string, password: string, autoRegister?: boolean) => {
  const store = getLocalUserAuthStore(email);

  const isRegistered = Boolean(store.get('email')) && Boolean(store.get('passwordHash'));

  if (!isRegistered) {
    if (autoRegister) {
      register(email, password);
    } else {
      await fs.unlink(store.path);
      throw new Error('User does not exists');
    }
  }

  const isInitial = false;

  if (hash(password).toString('hex') !== store.get('passwordHash')) {
    throw new Error('Incorrect password');
  }

  return {
    email,
    isInitial,
  };
};

export const clear = async (email: string) => {
  const store = getLocalUserAuthStore(email);
  await fs.unlink(store.path);
};
