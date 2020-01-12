require('dotenv').config()

module.exports = {
  setupFilesAfterEnv: ['<rootDir>/dist/setup.bundle.js'],
  moduleFileExtensions: ["node", "ts", "tsx", "js", "json"],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/dist/test.bundle.js']
};
