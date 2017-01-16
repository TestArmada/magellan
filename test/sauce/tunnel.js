/* eslint no-undef: 0, no-magic-numbers: 0 */
"use strict";
const expect = require("chai").expect;
const tunnel = require("../../src/sauce/tunnel");
const sinon = require("sinon");

describe("sauce/tunnel", () => {
  it("should initialize without access key", () => {
    const spy = sinon.spy();
    tunnel.initialize(spy,
      {
        env: {
          SAUCE_USERNAME: "foo",
          SAUCE_ACCESS_KEY: null
        },
        console: {log: () => {}},
        analytics: {
          push: () => {},
          mark: () => {}
        },
        sauceConnectLauncher: {
          download: (opts, cb) => {
            cb(null);
          }
        }
      });
    expect(spy.called).to.eql(true);
  });

  it("should initialize without username", () => {
    const spy = sinon.spy();
    tunnel.initialize(spy,
      {
        env: {
          SAUCE_USERNAME: null
        },
        console: {log: () => {}},
        analytics: {
          push: () => {},
          mark: () => {}
        },
        sauceConnectLauncher: {
          download: (opts, cb) => {
            cb(null);
          }
        }
      });
    expect(spy.called).to.eql(true);
  });

  it("should initialize", () => {
    const spy = sinon.spy();
    tunnel.initialize(spy,
      {
        console: {log: () => {}},
        analytics: {
          push: () => {},
          mark: () => {}
        },
        sauceConnectLauncher: {
          download: (opts, cb) => {
            cb(null);
          }
        }
      });
    expect(spy.called).to.eql(true);
  });

  it("should initialize", () => {
    const spy = sinon.spy();
    tunnel.initialize(spy,
      {
        console: {log: () => {}},
        analytics: {
          push: () => {},
          mark: () => {}
        },
        sauceConnectLauncher: {
          download: (opts, cb) => {
            cb(null);
          }
        }
      });
    expect(spy.called).to.eql(true);
  });

  it("should initialize with error", () => {
    const spy = sinon.spy();
    tunnel.initialize(spy,
      {
        env: {
          SAUCE_USERNAME: "foo",
          SAUCE_ACCESS_KEY: "bar"
        },
        console: {log: () => {}},
        analytics: {
          push: () => {},
          mark: () => {}
        },
        sauceConnectLauncher: {
          download: (opts, cb) => {
            cb(new Error("foo"));
          }
        }
      });
    expect(spy.called).to.eql(true);
  });

  it("should initialize without", () => {
    const spy = sinon.spy();
    tunnel.initialize(spy,
      {
        env: {
          SAUCE_USERNAME: "foo",
          SAUCE_ACCESS_KEY: "bar"
        },
        console: {log: () => {}},
        analytics: {
          push: () => {},
          mark: () => {}
        },
        sauceConnectLauncher: {
          download: (opts, cb) => {
            cb(null);
          }
        }
      });
    expect(spy.called).to.eql(true);
  });

  it("should open", () => {
    const spy = sinon.spy();
    tunnel.open(
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
          log: () => {},
          info: () => {}
        },
        sauceConnectLauncher: (opts, cb) => {
          cb(null, 15);
        }
      });
    expect(spy.called).to.eql(true);
  });

  it("should open with error", () => {
    const spy = sinon.spy();
    tunnel.open(
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
          log: () => {},
          info: () => {},
          error: () => {}
        },
        sauceConnectLauncher: (opts, cb) => {
          cb({message: "bar"});
        }
      });
    expect(spy.called).to.eql(true);
  });

  it("should open with error with debug", () => {
    const spy = sinon.spy();
    tunnel.open(
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
          log: () => {},
          info: () => {},
          error: () => {}
        },
        sauceConnectLauncher: (opts, cb) => {
          cb({message: "bar"});
        }
      });
    expect(spy.called).to.eql(true);
  });

  it("should open with error with not connecting", () => {
    const spy = sinon.spy();
    tunnel.open(
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
          log: () => {},
          info: () => {},
          error: () => {}
        },
        sauceConnectLauncher: (opts, cb) => {
          cb({message: "Could not start Sauce Connect"});
        }
      });
    expect(spy.called).to.eql(true);
  });

  it("should handle close", () => {
    const spy = sinon.spy();
    tunnel.close(
      {process: {
        close: (cb) => {
          cb();
        }
      }},
      spy,
      {
        console: {
          log: () => {}
        }
      });
    expect(spy.called).to.eql(true);
  });
});
