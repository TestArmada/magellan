var expect = require('chai').expect;
var tunnel = require('../../src/sauce/tunnel');
var sinon = require('sinon');

describe('sauce/tunnel', function() {
  it('should initialize without access key', function() {
    var spy = sinon.spy();
    var st = tunnel.initialize(spy,
      {
        env: {
          SAUCE_USERNAME: "foo",
          SAUCE_ACCESS_KEY: null
        },
        console: {log: function() {}},
        analytics: {
          push: function() {},
          mark: function() {}
        },
        sauceConnectLauncher: {
          download: function(opts, cb) {
            cb(null);
          }
        }
      });
    expect(spy.called).to.eql(true);
  });

  it('should initialize without username', function() {
    var spy = sinon.spy();
    var st = tunnel.initialize(spy,
      {
        env: {
          SAUCE_USERNAME: null
        },
        console: {log: function() {}},
        analytics: {
          push: function() {},
          mark: function() {}
        },
        sauceConnectLauncher: {
          download: function(opts, cb) {
            cb(null);
          }
        }
      });
    expect(spy.called).to.eql(true);
  });

  it('should initialize', function() {
    var spy = sinon.spy();
    var st = tunnel.initialize(spy,
      {
        console: {log: function() {}},
        analytics: {
          push: function() {},
          mark: function() {}
        },
        sauceConnectLauncher: {
          download: function(opts, cb) {
            cb(null);
          }
        }
      });
    expect(spy.called).to.eql(true);
  });

  it('should initialize', function() {
    var spy = sinon.spy();
    var st = tunnel.initialize(spy,
      {
        console: {log: function() {}},
        analytics: {
          push: function() {},
          mark: function() {}
        },
        sauceConnectLauncher: {
          download: function(opts, cb) {
            cb(null);
          }
        }
      });
    expect(spy.called).to.eql(true);
  });

  it('should initialize with error', function() {
    var spy = sinon.spy();
    var st = tunnel.initialize(spy,
      {
        env: {
          SAUCE_USERNAME: "foo",
          SAUCE_ACCESS_KEY: "bar"
        },
        console: {log: function() {}},
        analytics: {
          push: function() {},
          mark: function() {}
        },
        sauceConnectLauncher: {
          download: function(opts, cb) {
            cb(new Error("foo"));
          }
        }
      });
    expect(spy.called).to.eql(true);
  });

  it('should initialize without', function() {
    var spy = sinon.spy();
    var st = tunnel.initialize(spy,
      {
        env: {
          SAUCE_USERNAME: "foo",
          SAUCE_ACCESS_KEY: "bar"
        },
        console: {log: function() {}},
        analytics: {
          push: function() {},
          mark: function() {}
        },
        sauceConnectLauncher: {
          download: function(opts, cb) {
            cb(null);
          }
        }
      });
    expect(spy.called).to.eql(true);
  });

  it('should open', function() {
    var spy = sinon.spy();
    var st = tunnel.open(
      {
        tunnelId: "foo",
        callback: spy,
        seleniumPort: 10
      },
      {
        settings: {
          fastFailRegexps: true,
          debug: true
        },
        env: {
          SAUCE_USERNAME: "foo",
          SAUCE_ACCESS_KEY: "bar"
        },
        console: {
          log: function() {},
          info: function() {}
        },
        sauceConnectLauncher: function(opts, cb) {
          cb(null, 15);
        }
      });
    expect(spy.called).to.eql(true);
  });

  it('should open with error', function() {
    var spy = sinon.spy();
    var st = tunnel.open(
      {
        tunnelId: "foo",
        callback: spy
      },
      {
        settings: {
        },
        env: {
          SAUCE_USERNAME: "foo",
          SAUCE_ACCESS_KEY: "bar"
        },
        console: {
          log: function() {},
          info: function() {},
          error: function() {}
        },
        sauceConnectLauncher: function(opts, cb) {
          cb({message: "bar"});
        }
      });
    expect(spy.called).to.eql(true);
  });

  it('should open with error with debug', function() {
    var spy = sinon.spy();
    var st = tunnel.open(
      {
        tunnelId: "foo",
        callback: spy
      },
      {
        settings: {
          debug: true
        },
        env: {
          SAUCE_USERNAME: "foo",
          SAUCE_ACCESS_KEY: "bar"
        },
        console: {
          log: function() {},
          info: function() {},
          error: function() {}
        },
        sauceConnectLauncher: function(opts, cb) {
          cb({message: "bar"});
        }
      });
    expect(spy.called).to.eql(true);
  });

  it('should open with error with not connecting', function() {
    var spy = sinon.spy();
    var st = tunnel.open(
      {
        tunnelId: "foo",
        callback: spy
      },
      {
        settings: {
          debug: true
        },
        env: {
          SAUCE_USERNAME: "foo",
          SAUCE_ACCESS_KEY: "bar"
        },
        console: {
          log: function() {},
          info: function() {},
          error: function() {}
        },
        sauceConnectLauncher: function(opts, cb) {
          cb({message: "Could not start Sauce Connect"});
        }
      });
    expect(spy.called).to.eql(true);
  });

  it('should handle close', function() {
    var spy = sinon.spy();
    var st = tunnel.close(
      {process: {
        close: function (cb) {
          cb();
        }
      }},
      spy,
      {log: function() {}});
    expect(spy.called).to.eql(true);
  });
});
