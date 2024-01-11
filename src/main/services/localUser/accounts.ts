import Store, { Schema } from 'electron-store';

export type SchemaProperties = {
  accounts: { accountId: string; nickname: string }[];
};

/* persisting accounts data in a JSON file */
export default function getAccountsStore(email: string) {
  const schema: Schema<SchemaProperties> = {
    accounts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
          },
          nickname: {
            type: 'string',
          },
        },
      },
      default: [],
      uniqueItems: true,
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

export const getAccounts = (email: string) => {
  try {
    const store = getAccountsStore(email);
    return store.get('accounts');
  } catch (error) {
    return [];
  }
};

export const addAccount = (email: string, accountId: string, nickname: string = '') => {
  const store = getAccountsStore(email);

  if (
    store.store.accounts.some(
      acc => acc.accountId === accountId || (nickname && acc.nickname === nickname),
    )
  ) {
    throw new Error('Account ID or Nickname already exists!');
  }

  store.set('accounts', [...store.store.accounts, { accountId, nickname }]);

  return store.get('accounts');
};

export const removeAccount = (email: string, accountId: string, nickname?: string) => {
  const store = getAccountsStore(email);

  if (
    !store.store.accounts.some(
      acc => acc.accountId === accountId || (nickname && acc.nickname === nickname),
    )
  ) {
    throw new Error(`Account ID ${nickname && `or ${nickname}`} not found!`);
  }

  store.set(
    'accounts',
    store.store.accounts.filter(
      acc => acc.accountId !== accountId || (nickname && acc.nickname !== nickname),
    ),
  );

  return store.get('accounts');
};
