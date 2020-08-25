'use strict';

const Bail = require('../../src/strategies/bail');

test('should construct with default rule', () => {
  const bail = new Bail({});

  expect(bail.hasBailed).toEqual(false);
  expect(bail.name).toEqual('testarmada-magellan-never-bail-strategy');
});

test('should construct with given rule', () => {
  const bail = new Bail({ strategy_bail: '../../test/strategies/mockBail' });

  expect(bail.hasBailed).toEqual(false);
  expect(bail.name).toEqual('fake-bail-strategy');
});

test('should throw error if errors in module loading', () => {
  try {
    new Bail({ strategy_bail: './bail/fake' });
    fail();
  } catch (err) {
    expect(err).toBeTruthy();
  }
});

test('should get description', () => {
  const bail = new Bail({});
  expect(bail.getDescription()).toEqual('Magellan never bails, all tests will be executed at least once');
});

test('should warn if no description', () => {
  const bail = new Bail({strategy_bail: '../../test/strategies/mockBail'});
  expect(bail.getDescription()).toEqual('');
});

test('should get bail reason', () => {
  const bail = new Bail({});
  expect(bail.getBailReason()).toEqual('Magellan should never bail, it should never reach here');
});

test('should warn if no bail reason', () => {
  const bail = new Bail({strategy_bail: '../../test/strategies/mockBail'});
  expect(bail.getBailReason()).toEqual('');
});

test('should tell if never bails', () => {
  const bail = new Bail({ });
  expect(bail.shouldBail()).toEqual(false);
  expect(bail.shouldBail()).toEqual(false);
});

test('should tell if bails', () => {
  const bail = new Bail({ strategy_bail: '../../test/strategies/mockBail' });
  expect(bail.shouldBail()).toEqual(true);
  expect(bail.shouldBail()).toEqual(true);
});