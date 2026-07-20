module.exports = {
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

  // `jose` ships ESM only; this CJS runner must transform it.
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],

  // Mirrors the `paths` in tsconfig.
  moduleNameMapper: {
    // Force the compiled CJS entry: ts-jest otherwise resolves `typeorm` to
    // its .ts source, where decorators load as undefined.
    '^typeorm$': '<rootDir>/../../node_modules/typeorm/index.js',
    '^@app/(.*)$': '<rootDir>/src/$1',
    '@shared': '<rootDir>../../libs/shared/src/index.ts',
  },
};
