require('dotenv').config()

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/dist/tests.bundle.js'],
  setupFilesAfterEnv: ['./dist/setup.bundle.js'],
};
