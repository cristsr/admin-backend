/* eslint-disable */
export default {
  displayName: 'finances',
  preset: '../../jest.preset.js',
  globals: {},
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/finances',

  moduleNameMapper: {
    // 'config/(.*)': '<rootDir>/src/config/$1',
    // 'shared/(.*)': '<rootDir>/src/shared/$1',
    // 'utilities/(.*)': '<rootDir>/src/utilities/$1',
    // 'testing/(.*)': '<rootDir>/src/testing/$1',

    // Force the compiled CJS entry: under ts-jest, @nestjs/typeorm otherwise
    // resolves `typeorm` to its .ts source, where the decorators load as
    // undefined (`PrimaryGeneratedColumn is not a function`).
    '^typeorm$': '<rootDir>/../../node_modules/typeorm/index.js',
    '@shared': '<rootDir>../../libs/shared/src/index.ts',
    '@core': '<rootDir>../../libs/core/src/index.ts',
    // Anchored: unanchored `env` matched any module id containing "env"
    // (e.g. inside @shared/auth), mis-mapping it to this env.ts and creating a
    // circular init (`mapEnvironmentKeys is not a function`).
    '^env$': '<rootDir>/src/env',
    '^app/(.*)$': '<rootDir>/src/$1',
    'database/(.*)': '<rootDir>/src/database/$1',
  },
};
