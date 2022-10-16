/* eslint-disable */
export default {
  displayName: 'finances',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/finances',

  moduleNameMapper: {
    // 'config/(.*)': '<rootDir>/src/config/$1',
    // 'shared/(.*)': '<rootDir>/src/shared/$1',
    // 'utilities/(.*)': '<rootDir>/src/utilities/$1',
    // 'testing/(.*)': '<rootDir>/src/testing/$1',

    '@admin-back/shared': '<rootDir>../../libs/shared/src/index.ts',
    '@admin-back/grpc': '<rootDir>../../libs/grpc/src/index.ts',
    env: '<rootDir>/src/env',
    'app/(.*)': '<rootDir>/src/app/$1',
    'database/(.*)': '<rootDir>/src/database/$1',
  },
};
