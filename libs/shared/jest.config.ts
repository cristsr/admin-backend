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

  // jose ships ESM only and this runner is CJS, so it must be transformed.
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],
};
