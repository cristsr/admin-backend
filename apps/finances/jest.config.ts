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

  // `jose` (pulled in by jwks-rsa) ships ESM only, and this runner is CJS, so
  // it has to go through the transform instead of being skipped like the rest
  // of node_modules.
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],

  // Mirrors the `paths` in tsconfig: @app/* for anything inside this app and
  // @shared for the workspace lib. Nothing else — the old bare `env` and
  // `database/*` mappings are gone along with their last usage.
  moduleNameMapper: {
    // Force the compiled CJS entry: under ts-jest, @nestjs/typeorm otherwise
    // resolves `typeorm` to its .ts source, where the decorators load as
    // undefined (`PrimaryGeneratedColumn is not a function`).
    '^typeorm$': '<rootDir>/../../node_modules/typeorm/index.js',
    '^@app/(.*)$': '<rootDir>/src/$1',
    '@shared': '<rootDir>../../libs/shared/src/index.ts',
  },
};
