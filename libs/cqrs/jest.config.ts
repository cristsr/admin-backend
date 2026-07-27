module.exports = {
  displayName: 'cqrs',
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
  coverageDirectory: '../../coverage/libs/cqrs',

  // Importing the `@shared` barrel pulls its auth module, and from there
  // jwks-rsa -> jose, which ships ESM only while this runner is CJS.
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],

  // Mirrors the `paths` in tsconfig.
  moduleNameMapper: {
    // Force the compiled CJS entry: ts-jest otherwise resolves `typeorm` to
    // its .ts source, where decorators load as undefined.
    '^typeorm$': '<rootDir>/../../node_modules/typeorm/index.js',
    '^@cqrs/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../libs/shared/src/$1',
    '^@shared$': '<rootDir>/../../libs/shared/src/index.ts',
  },
};
