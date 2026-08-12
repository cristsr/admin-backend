// Standalone runner: `tools/` is workspace tooling, not an Nx project, so it is not
// picked up by getJestProjectsAsync() in the root config. A full Nx target would be
// disproportionate for one validation script (Simplicity Gate) -- this config plus the
// `test:tools` npm script is the smallest thing that satisfies Article 4 (TDD).
module.exports = {
  displayName: 'tools',
  preset: '../jest.preset.js',
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../coverage/tools',
};
