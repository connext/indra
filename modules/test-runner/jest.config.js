require('dotenv').config()

module.exports = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ['./src/setup.ts'],
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': 'ts-jest', },
};
