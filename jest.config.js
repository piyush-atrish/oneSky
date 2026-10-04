module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transformIgnorePatterns: ['node_modules/(?!(three)/)'],
  transform: { '^.+\\.tsx?$': 'ts-jest', '^.+\\.jsx?$': 'babel-jest' },
};