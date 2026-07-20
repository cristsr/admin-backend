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
  // `jose` ships ESM only; this CJS runner must transform it.
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],
  // Mirrors the tsconfig `paths`.
  moduleNameMapper: {
    '^typeorm$': '<rootDir>/../../node_modules/typeorm/index.js',
    '^@app/(.*)$': '<rootDir>/src/$1',
    '@shared': '<rootDir>/../../libs/shared/src/index.ts',
  },
};
