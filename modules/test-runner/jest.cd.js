require('dotenv').config()

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/dist/test.bundle.js'],
  setupFilesAfterEnv: ['<rootDir>/dist/setup.bundle.js'],
};
