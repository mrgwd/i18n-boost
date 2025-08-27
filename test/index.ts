import * as assert from 'assert';

// Mocha will automatically find and run all *.test.ts files in the test/ directory.
// This file can be used for global setup if needed, but is not required for most simple projects.

// Example: Basic sanity test to verify test runner works
describe('Sanity Check', () => {
  it('should run tests', () => {
    assert.strictEqual(1 + 1, 2);
  });
});
