import Store, { Schema } from 'electron-store';

export type SchemaProperties = {
  mirrorNodeSettings: {
    mainnetLink: string;
    testnetLink: string;
    previewnetLink: string;
  };
};

/* Module for persisting data in a JSON file */
export default function getStore() {
  /* See more about JSON Schema here: https://json-schema.org/learn/getting-started-step-by-step */

  const schema: Schema<SchemaProperties> = {
    mirrorNodeSettings: {
      type: 'object',
      properties: {
        mainnetLink: {
          type: 'string',
        },
        testnetLink: {
          format: 'uri',
        },
        previewnetLink: {
          type: 'string',
        },
      },
    },
  };

  const store = new Store({ schema });

  return store;
}
