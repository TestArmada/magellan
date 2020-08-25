/* eslint no-undef: 0 */
'use strict';

const settings = require('../src/settings');
const getTests = require('../src/get_tests');

jest.mock('../src/settings', () => {
  return {
    testFramework: {
      iterator: () => ['a', 'b', 'c'],
      filters: {
        a: () => true,
        b: () => true
      }
    }
  };
});

describe('getTests', () => {
  test('should get tests', () => {
    const tests = getTests({
      a: () => true,
      b: () => true
    });
    expect(tests).toEqual(true);
  });
});
