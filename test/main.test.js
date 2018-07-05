/* eslint no-undef: 0, no-unused-expressions: 0 */
'use strict';

const main = require('../src/main');

describe('main', () => {
  test('should have stuff', () => {
    expect(main.Reporter).not.toBeNull();
    expect(main.portUtil).not.toBeNull();
  });
});
