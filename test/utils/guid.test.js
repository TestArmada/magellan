/* eslint no-undef: 0, no-unused-expressions: 0 */
'use strict';

const guid = require('../../src/util/guid');

it('should create a guid', () => {
  expect(guid()).not.toBeNull();
});
