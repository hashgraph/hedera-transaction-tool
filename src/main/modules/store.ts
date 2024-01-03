import Store, { Schema } from 'electron-store';

export type Organization = {
  name: string;
  serverUrl: string;
  serverPublicKey: string;
};

export type SchemaProperties = {
  organizations: Organization[];
};

/* Module for persisting data in a JSON file */
export default function getStore() {
  /* See more about JSON Schema here: https://json-schema.org/learn/getting-started-step-by-step */

  const schema: Schema<SchemaProperties> = {
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
          serverUrl: {
            type: 'string',
          },
          serverPublicKey: {
            type: 'string',
          },
        },
      },
      default: [],
      uniqueItems: true,
    },
  };

  const store = new Store({ schema, clearInvalidConfig: true });

  return store;
}
