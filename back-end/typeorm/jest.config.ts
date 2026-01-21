import type { Config } from 'jest';
import baseConfig from '../jest.config';

const config: Config = {
  ...baseConfig,
  rootDir: '.',
  collectCoverageFrom: [
    'migrations/**/*.ts',
    'data-source.ts',
  ],
  roots: ['<rootDir>/test'],
  setupFilesAfterEnv: ['<rootDir>/../libs/common/jest.setup.ts'],
};

export default config;
