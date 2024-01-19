import { getUserStorageFolderPath, userStorageFolderName } from '.';

import fs from 'fs/promises';
import path from 'path';

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
    cwd: getUserStorageFolderPath(email),
    name: `auth`,
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

export const login = async (
  appPath: string,
  email: string,
  password: string,
  autoRegister?: boolean,
) => {
  const registeredUsers = await getRegisteredUsers(appPath);

  if (registeredUsers.length > 0) {
    const store = getLocalUserAuthStore(registeredUsers[0]);

    if (autoRegister) {
      register(email, password);
    } else if (email != registeredUsers[0]) {
      await fs.unlink(store.path);
      throw new Error('Incorrect email');
    }

    if (hash(password).toString('hex') !== store.get('passwordHash')) {
      throw new Error('Incorrect password');
    }
  }

  return {
    email,
  };
};

export const clear = async (email: string) => {
  const store = getLocalUserAuthStore(email);
  await fs.unlink(store.path);
};

export const getRegisteredUsers = async (appPath: string) => {
  try {
    const userStoragePath = path.join(appPath, userStorageFolderName);

    const directories = (await fs.readdir(userStoragePath, { withFileTypes: true }))
      .filter(dirent => dirent.isDirectory())
      .map(dir => dir.name);

    return directories;
  } catch {
    return [];
  }
};

export const hasRegisteredUsers = async (appPath: string) => {
  try {
    const userStoragePath = path.join(appPath, userStorageFolderName);

    const directories = (await fs.readdir(userStoragePath, { withFileTypes: true }))
      .filter(dirent => dirent.isDirectory())
      .map(dir => dir.name);

    return directories.length > 0;
  } catch {
    return false;
  }
};
