'use strict';

const Resource = require('../../src/strategies/resource');

test('should construct with default rule', () => {
  const resource = new Resource({});

  expect(resource.name).toEqual('testarmada-magellan-no-resource-strategy');
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

test('should get failReason', () => {
  const resource = new Resource({});
  expect(resource.getFailReason()).toEqual('Magellan shouldn\'t depend on any resource manager to control test run');
});

test('should hold test resource', ()=>{
  const resource = new Resource({});
  return expect(resource.holdTestResource('fake resource')).resolves.toEqual('fake resource');
});

test('should hold suite resources', ()=>{
  const resource = new Resource({});
  return expect(resource.holdSuiteResources('fake resources')).resolves.toEqual('fake resources');
});

test('should release test resource', ()=>{
  const resource = new Resource({});
  return expect(resource.releaseTestResource('fake resource')).resolves.toEqual('fake resource');
});

test('should release suite resources', ()=>{
  const resource = new Resource({});
  return expect(resource.releaseSuiteResources('fake resources')).resolves.toEqual('fake resources');
});