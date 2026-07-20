 
module.exports = {
  displayName: 'shared',
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
  coverageDirectory: '../../coverage/libs/shared',

  // `jose` (pulled in by jwks-rsa, which `auth/jwt.strategy` imports) ships ESM
  // only, and this runner is CJS, so it has to go through the transform instead
  // of being skipped like the rest of node_modules. Mirrors the finances config.
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],
};
