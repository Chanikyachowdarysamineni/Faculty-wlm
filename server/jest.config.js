export default {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/db.js',
    '!src/seed.js',
    '!src/diagnostic.js',
    '!src/scripts/**'
  ],
  testTimeout: 10000,
  forceExit: true,
  clearMocks: true,
};
