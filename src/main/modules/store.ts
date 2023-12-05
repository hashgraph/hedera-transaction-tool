import Store, { Schema } from 'electron-store';

export type Organization = {
  name: string;
  serverUrl: string;
  serverPublicKey: string;
};

export type SchemaProperties = {
  mirrorNodeLinks: {
    mainnetLink: string;
    testnetLink: string;
    previewnetLink: string;
  };
  organizations: Organization[];
};

/* Module for persisting data in a JSON file */
export default function getStore() {
  /* See more about JSON Schema here: https://json-schema.org/learn/getting-started-step-by-step */

  const schema: Schema<SchemaProperties> = {
    mirrorNodeLinks: {
      type: 'object',
      properties: {
        mainnetLink: {
          type: 'string',
        },
        testnetLink: {
          type: 'string',
        },
        previewnetLink: {
          type: 'string',
        },
      },
      default: {
        mainnetLink: '',
        testnetLink: '',
        previewnetLink: '',
      },
    },
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
        required: ['name', 'serverUrl', 'serverPublicKey'],
      },
      default: [],
      uniqueItems: true,
    },
  };

  const store = new Store({ schema });

  return store;
}
