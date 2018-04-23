/* eslint no-undef: 0, no-unused-expressions: 0, no-magic-numbers: 0, callback-return: 0 */
'use strict';

const sinon = require('sinon');

const checkPorts = require('../../src/util/check_ports');
const portUtil = require('../../src/util/port_util');

jest.mock('../../src/util/check_ports');

test('should get the next port', () => {
  expect(portUtil.getNextPort()).toEqual(12000)
  expect(portUtil.getNextPort()).toEqual(12003);
});

test('should acquire a port', () => {
  checkPorts.mockImplementation((arr, cb) => cb([{
    port: arr[0],
    available: true
  }]));

  const spy = sinon.spy();

  portUtil.acquirePort(spy);

  expect(spy.called).toEqual(true);
  expect(spy.args[0]).toEqual([null, 12006]);
});

test('should acquire a port after several retries', () => {
  checkPorts.mockImplementation((arr, cb) => {
    arr[0] < 12020 ? cb([{
      port: arr[0],
      available: false
    }]) : cb([{
      port: arr[0],
      available: true
    }]);
  });

  const spy = sinon.spy();

  portUtil.acquirePort(spy);

  expect(spy.called).toEqual(true);
  expect(spy.args[0]).toEqual([null, 12021]);
});

test('should throw exception after maximum retries', () => {
  checkPorts.mockImplementation((arr, cb) => cb([{
    port: arr[0],
    available: false
  }]));

  const spy = sinon.spy();

  portUtil.acquirePort(spy);

  expect(spy.called).toEqual(true);
  expect(spy.args[0][0].message).toEqual('Gave up looking for an available port after 100 attempts.');
});
