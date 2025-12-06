import type { Config } from 'jest';

const includeLibs = process.env.INCLUDE_LIBS !== '0';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  // keep config local to the app folder
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['<rootDir>/src/**/*.{!(module),}.(t|j)s'],
  testEnvironment: 'node',
  // include libs only when INCLUDE_LIBS !== '0'
  roots: includeLibs ? ['<rootDir>/../../libs/', '<rootDir>/src'] : ['<rootDir>/src'],
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/../../libs/common/src/$1',
    '^@entities(|/.*)$': '<rootDir>/../../libs/common/src/database/entities/$1',
  },
};

if (process.env.CI) {
  config.maxWorkers = 2;
}

export default config;