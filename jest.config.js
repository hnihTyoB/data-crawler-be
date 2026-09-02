module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    'node-html-parser': '<rootDir>/src/__mocks__/node-html-parser.ts',
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};