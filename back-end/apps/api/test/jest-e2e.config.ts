import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../',
  testRegex: '.e2e-spec.ts$',
  maxWorkers: 1,
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['<rootDir>/src/**/*.{!(module),}.(t|j)s'],
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/globalSetup.ts',
  globalTeardown: '<rootDir>/test/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/test/setup-jest.ts'],
  roots: ['<rootDir>../../libs/', '<rootDir>'],
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>../../libs/common/src/$1',
    '^@entities(|/.*)$': '<rootDir>../../libs/common/src/database/entities/$1',
  },
};

export default config;
