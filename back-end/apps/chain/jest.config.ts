import type { Config } from 'jest';
import baseConfig from '../../jest.config';

const includeLibs = process.env.INCLUDE_LIBS !== '0';

const config: Config = {
  ...baseConfig,
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/../../libs/common/jest.setup.ts'],
  collectCoverageFrom: ['<rootDir>/src/**/*.{!(module),}.(t|j)s'],
  // include libs only when INCLUDE_LIBS !== '0'
  roots: includeLibs ? ['<rootDir>/../../libs/', '<rootDir>/src'] : ['<rootDir>/src'],
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/../../libs/common/src/$1',
    '^@entities(|/.*)$': '<rootDir>/../../libs/common/src/database/entities/$1',
  },
};

export default config;
