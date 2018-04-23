/* eslint no-undef: 0, no-unused-expressions: 0 */
'use strict';

const fs = require('fs');
const mkdirSync = require('../../src/util/mkdir_sync');

jest.mock('fs');

test('should create path', () => {
  fs.mkdirSync.mockImplementation((p) => { });

  const r = mkdirSync('fakePath');

  expect(r).toBeUndefined();
});

test('should throw error', () => {
  fs.mkdirSync.mockImplementation((p) => { throw { code: 'FAKE_ERROR' } });

  try {
    mkdirSync('fakePath');
    fail();
  } catch (e) {
    expect(e.code).toEqual('FAKE_ERROR');
  }
});

test('shouldn\'t throw error if error is EEXIST', () => {
  fs.mkdirSync.mockImplementation((p) => { throw { code: 'EEXIST' } });

  try {
    mkdirSync('fakePath');
   
  } catch (e) {
    fail();
  }
});
