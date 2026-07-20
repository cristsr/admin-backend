export default {
  displayName: 'finances-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // `jose` (pulled in by jwks-rsa) ships ESM only, and this runner is CJS, so
  // it has to go through the transform instead of being skipped like the rest
  // of node_modules. The e2e app boots AuthModule, so it reaches it too.
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],
  // Mirrors the unit config and the tsconfig `paths`: @app/* and @shared.
  moduleNameMapper: {
    '^typeorm$': '<rootDir>/../../node_modules/typeorm/index.js',
    '^@app/(.*)$': '<rootDir>/src/$1',
    '@shared': '<rootDir>/../../libs/shared/src/index.ts',
  },
};
