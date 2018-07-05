'use strict';

const Resource = require('../../src/strategies/resource');

test('should construct with default rule', () => {
  const resource = new Resource({});

  expect(resource.name).toEqual('testarmada-magellan-no-resource-strategy');
});

test('should construct with given rule', () => {
  const resource = new Resource({ strategy_resource: '../../test/strategies/mockResource' });

  expect(resource.name).toEqual('fake-resource-strategy');
});

test('should throw error if errors in module loading', () => {
  try {
    new Resource({ strategy_resource: './resource/fake' });
    fail();
  } catch (err) {
    expect(err).toBeTruthy();
  }
});

test('should get description', () => {
  const resource = new Resource({});
  expect(resource.getDescription()).toEqual('Magellan doesn\'t require a resource manager to schedule test run');
});

test('should warn if no description', () => {
  const resource = new Resource({ strategy_resource: '../../test/strategies/mockResource' });
  expect(resource.getDescription()).toEqual('');
});

test('should get failReason', () => {
  const resource = new Resource({});
  expect(resource.getFailReason()).toEqual('Magellan shouldn\'t depend on any resource manager to control test run');
});

test('should warn if no failReason', () => {
  const resource = new Resource({ strategy_resource: '../../test/strategies/mockResource' });
  expect(resource.getFailReason()).toEqual('');
});

test('should hold test resource', () => {
  const resource = new Resource({});
  return expect(resource.holdTestResource('fake resource')).resolves.toEqual('fake resource');
});

test('should return promise.resolve if no hold test resource', () => {
  const resource = new Resource({ strategy_resource: '../../test/strategies/mockResource' });
  return expect(resource.holdTestResource('fake resource')).resolves.toEqual('fake resource');
});

test('should hold suite resources', () => {
  const resource = new Resource({});
  return expect(resource.holdSuiteResources('fake resources')).resolves.toEqual('fake resources');
});

test('should return promise.resolve if no hold suite resources', () => {
  const resource = new Resource({ strategy_resource: '../../test/strategies/mockResource' });
  return expect(resource.holdSuiteResources('fake resources')).resolves.toEqual('fake resources');
});

test('should release test resource', () => {
  const resource = new Resource({});
  return expect(resource.releaseTestResource('fake resource')).resolves.toEqual('fake resource');
});

test('should return promise.resolve if no release test resource', () => {
  const resource = new Resource({ strategy_resource: '../../test/strategies/mockResource' });
  return expect(resource.releaseTestResource('fake resource')).resolves.toEqual('fake resource');
});

test('should return promise.resolve if release test resource fails', () => {
  const resource = new Resource({ strategy_resource: '../../test/strategies/mockResourceReject' });
  return expect(resource.releaseTestResource('fake resource')).resolves.toEqual('fake resource');
});

test('should release suite resources', () => {
  const resource = new Resource({});
  return expect(resource.releaseSuiteResources('fake resources')).resolves.toEqual('fake resources');
});

test('should return promise.resolve if no release suite resources', () => {
  const resource = new Resource({ strategy_resource: '../../test/strategies/mockResource' });
  return expect(resource.releaseSuiteResources('fake resources')).resolves.toEqual('fake resources');
});

test('should return promise.resolve if release suite resources fails', () => {
  const resource = new Resource({ strategy_resource: '../../test/strategies/mockResourceReject' });
  return expect(resource.releaseSuiteResources('fake resources')).resolves.toEqual('fake resources');
});