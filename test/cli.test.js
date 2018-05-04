"use strict";

const _ = require("lodash");

const cli = require("../src/cli.js");
const profiles = require("../src/profiles");
const settings = require('../src/settings');
const syncRequest = require('sync-request');

jest.mock("../src/profiles");
jest.mock('../src/settings');
jest.mock('sync-request');

describe("cli", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should initialize", () => {
    cli.initialize();
  });

  test('should print version', () => {
    cli.version();
  });

  test('should print help', () => {
    expect(cli.help()).rejects.toThrow("end of help");
  });

  test('should detect profiles', () => {
    profiles.detectFromCLI.mockImplementation(() => Promise.resolve('haha'));

    expect(cli.detectProfiles({ argv: {}, settings: {} })).resolves.toEqual('haha');
  });

  describe("resolve framework", () => {
    test("should handle framework load exception", () => {
      expect(cli.loadFramework({
        argv: '',
        mockFramework: 'err'
      })).rejects.toEqual("Couldn't start Magellan");
    });

    test("should transilate legacy framework name", () => {
      expect(cli.loadFramework({
        argv: '',
        mockFramework: 'vanilla-mocha'
      })).resolves.toEqual();
    });
  });


  describe('resolve listener', () => {
    test('should load setup_teardown', () => {
      expect(cli.loadListeners({
        argv: {
          setup_teardown: './test/mock/mockSetupTeardownListener.js'
        }
      })).resolves.toHaveLength(1);
    });

    test('should load serial reporter', () => {
      expect(cli.loadListeners({
        argv: {
          serial: true
        }
      })).resolves.toHaveLength(1);
    });

    test('should load reporters as array', () => {
      expect(cli.loadListeners({
        argv: {
          reporters: [
            './src/reporters/stdout/reporter'
          ]
        }
      })).resolves.toHaveLength(1);
    });

    test('should load optional reporters as array', () => {
      expect(cli.loadListeners({
        argv: {
          optional_reporters: [
            './test/mock/mockOptionalReporter.js'
          ]
        }
      })).rejects.toBeInstanceOf(Error);
    });
  });

  test('should detect profile', () => {
    profiles.detectFromCLI.mockImplementation(() => Promise.resolve('haha'));

    expect(cli.detectProfiles({
      argv: {
        profile: 'http://some_fake_url#chrome'
      },
      settings: {
        testExecutors: {
          'sauce': {
            getProfiles: (opts) => Promise.resolve(opts.profiles),
            getCapabilities: (profile, opts) => Promise.resolve(profile)
          }
        }
      }
    })).resolves.toEqual('haha')
  });

  describe('resolve executor', () => {
    afterEach(() => {
      delete settings.testExecutors;
    });

    test('should enable executor', (done) => {
      settings.testExecutors = {
        local: {
          name: 'fake executor',
          validateConfig() { }
        }
      };

      cli.enableExecutors({
        profiles: [{
          executor: 'local'
        }]
      })
        .then(es => {
          expect(es.local.name).toEqual('fake executor');
          done();
        });
    });

    test('should not enable executor if no match', (done) => {
      settings.testExecutors = {
        sauce: {
          validateConfig() { }
        }
      };

      cli.enableExecutors({
        profiles: [{
          executor: 'local'
        }]
      })
        .then(es => {
          expect(es.local).toBeUndefined();
          done();
        });
    });

    test('should reject if validateConfig throws error', (done) => {
      settings.testExecutors = {
        local: {
          validateConfig() { throw new Error('on purpose'); }
        }
      };

      cli.enableExecutors({
        profiles: [{
          executor: 'local'
        }]
      })
        .catch(e => {
          expect(e).toBeInstanceOf(Error);
          expect(e.message).toEqual('on purpose');
          done();
        });
    });
  });

  describe('resolve strategies', () => {
    afterEach(() => {
      delete settings.strategies;
    });

    test('should resolve bail strategy', (done) => {
      cli.loadStrategies({ argv: {} })
        .then(strategies => {
          expect(strategies.bail.hasBailed).toEqual(false);
          done();
        });
    });

    test('should reject if fails in loading bail strategy', (done) => {
      cli.loadStrategies({ argv: { strategy_bail: 'error' } })
        .catch(err => {
          expect(err).toEqual("Couldn't start Magellan");
          done();
        });
    });

    test('should resolve resource strategy', (done) => {
      cli.loadStrategies({ argv: {} })
        .then(strategies => {
          expect(strategies.resource.name).toEqual('testarmada-magellan-no-resource-strategy');
          done();
        });
    });

    test('should reject if fails in loading resouorce strategy', (done) => {
      cli.loadStrategies({ argv: { strategy_resource: 'error' } })
        .catch(err => {
          expect(err).toEqual("Couldn't start Magellan");
          done();
        });
    });
  });

  describe('resolve executors', () => {

    test('should load executors', (done) => {
      cli.loadExecutors({ argv: { executors: ['testarmada-magellan-local-executor'] } })
        .then(() => {
          done();
        });
    });

    test('should convert executor to array and load', (done) => {
      cli.loadExecutors({ argv: { executors: 'testarmada-magellan-local-executor' } })
        .then(() => {
          done();
        });
    });

    test('should alert if no string or array provided and use default', (done) => {
      cli.loadExecutors({ argv: { executors: { a: 'testarmada-magellan-local-executor' } } })
        .then(() => {
          done();
        });
    });

    test('should alert if executor is given and use default', (done) => {
      cli.loadExecutors({ argv: {} })
        .then(() => {
          done();
        });
    });

    test('should reject if fails in loading one executor', (done) => {
      cli.loadExecutors({ argv: {executors: ['testarmada-magellan-local-executor', 'err']} })
        .catch((e) => {
          expect(e).toEqual("Couldn't start Magellan");
          done();
        });
    });
  });

});