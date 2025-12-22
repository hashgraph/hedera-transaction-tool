import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['<rootDir>/libs/common/src/**/*.{!(module),}.(t|j)s'],
  roots: ['<rootDir>/libs/'],
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
    '^@entities(|/.*)$': '<rootDir>/libs/common/src/database/entities/$1',
  },
};

if (process.env.CI) {
  config.maxWorkers = 2; // This is to prevent Jest from starving the worker in CI environments and causing instability
}

export default config;
