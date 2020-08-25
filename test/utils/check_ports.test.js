/* eslint no-undef: 0, no-magic-numbers: 0, no-unused-expressions: 0 */
'use strict';

const request = require('request');
const portscanner = require('portscanner');

const checkPorts = require('../../src/util/check_ports');
const sinon = require('sinon');

jest.mock('request');
jest.mock('portscanner');

test('port isn\'t available', () => {
  request.mockImplementation((opts, cb) => cb(null));

  const spy = sinon.spy();

  checkPorts([10], spy);

  expect(spy.called).toEqual(true);
  expect(spy.args[0][0]).toEqual([{ 'port': 10, 'available': false }]);
});

test('port is occupied by other process', () => {
  request.mockImplementation((opts, cb) => {
    const err = new Error('fake selenium error');
    err.code = 'ECONNREFUSED';

    return cb(err);
  });

  portscanner.checkPortStatus.mockImplementation((port, host, cb) => cb(null, 'open'));

  const spy = sinon.spy();

  checkPorts([10], spy);

  expect(spy.called).toEqual(true);
  expect(spy.args[0][0]).toEqual([{ 'port': 10, 'available': false }]);
});

test('port is available', () => {
  request.mockImplementation((opts, cb) => {
    const err = new Error('fake selenium error');
    err.code = 'ECONNREFUSED';

    return cb(err);
  });

  portscanner.checkPortStatus.mockImplementation((port, host, cb) => cb(null, 'closed'));

  const spy = sinon.spy();

  checkPorts([10], spy);

  expect(spy.called).toEqual(true);
  expect(spy.args[0][0]).toEqual([{ 'port': 10, 'available': true }]);
});
