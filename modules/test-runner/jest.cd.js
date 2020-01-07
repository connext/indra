require('dotenv').config()

module.exports = {
  setupFilesAfterEnv: ['<rootDir>/dist/setup.bundle.js'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/dist/test.bundle.js']
};
