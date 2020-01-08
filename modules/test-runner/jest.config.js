require('dotenv').config()

module.exports = {
  globalSetup: './src/globalSetup.ts',
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./src/setup.ts'],
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': 'ts-jest', },
};
