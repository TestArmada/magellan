/* eslint no-undef: 0, no-magic-numbers: 0, no-unused-expressions: 0 */
"use strict";
var expect = require("chai").expect;
var WorkerAllocator = require("../../src/sauce/worker_allocator");
var sinon = require("sinon");
var _ = require("lodash");

var _settingsBuilder = function (extra) {
  return _.merge({
    console: {log: function () {}},
    setTimeout: function (cb) {cb();},
    clearTimeout: function () {},
    tunnel: {
      initialize: function (cb) {
        cb(null);
      },
      open: function (opts) {
        opts.callback(null, {});
      }
    },
    sauceSettings: {
      useTunnels: true,
      maxTunnels: 1,
      locksServerLocation: "foo"
    }
  }, extra);
};

describe("sauce/worker_allocator", function () {
  it("should create", function () {
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      sauceSettings: {
        locksServerLocation: "foo/"
      }
    });
    expect(wa.tunnelPrefix).to.not.be.null;
  });

  it("should create without sauceSettings", function () {
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      }
    });
    expect(wa.tunnelPrefix).to.not.be.null;
  });

  it("should release", function () {
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      request: function (opts, cb) {
        expect(opts).to.not.be.null;
        cb();
      },
      sauceSettings: {
        locksServerLocation: "foo/"
      }
    });
    wa.release(wa.workers[0]);
  });

  it("should release without server loc", function () {
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      request: function (opts, cb) {
        expect(opts).to.not.be.null;
        cb();
      },
      sauceSettings: {
      }
    });
    wa.release(wa.workers[0]);
  });

  it("should teardown", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      request: function (opts, cb) {
        expect(opts).to.not.be.null;
        cb();
      },
      sauceSettings: {
        locksServerLocation: "foo/"
      }
    });
    wa.teardown(spy);
    expect(spy.called).to.be.true;
  });

  it("should teardown with tunnels", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      request: function (opts, cb) {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: function (cb) {
        cb();
      },
      clearTimeout: function () {},
      sauceSettings: {
        useTunnels: true
      },
      settings: {
        debug: true
      }
    });
    wa.teardown(spy);
    expect(spy.called).to.be.true;
  });

  it("should initialize with nothing", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      request: function (opts, cb) {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: function (cb) {
        cb();
      },
      clearTimeout: function () {},
      sauceSettings: {
      },
      settings: {
        debug: true
      }
    });
    wa.initialize(spy);
    expect(spy.called).to.be.true;
  });

  it("should initialize with sauceTunnelId", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      request: function (opts, cb) {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: function (cb) {
        cb();
      },
      clearTimeout: function () {},
      sauceSettings: {
        sauceTunnelId: 52
      }
    });
    wa.initialize(spy);
    expect(spy.called).to.be.true;
  });

  it("should initialize without sauceTunnelId", function (done) {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      request: function (opts, cb) {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: function (cb) {
        cb();
      },
      clearTimeout: function () {},
      tunnel: {
        initialize: function (cb) {
          cb(null);
        },
        open: function (opts) {
          opts.callback(null, {});
        },
        close: function (tunnel, cb) {
          cb();
        }
      },
      sauceSettings: {
        useTunnels: true,
        maxTunnels: 2
      }
    });
    wa.initialize(function () {
      wa.teardownTunnels(spy);
      done();
    });
  });

  it("should initialize without sauceTunnelId with tunnel error", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      request: function (opts, cb) {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: function (cb) {
        cb();
      },
      clearTimeout: function () {},
      tunnel: {
        initialize: function (cb) {
          cb(null);
        },
        open: function (opts) {
          opts.callback(new Error("bad tunnel"), {});
        }
      },
      sauceSettings: {
        useTunnels: true,
        maxTunnels: 1
      }
    });
    wa.initialize(spy);
    wa.teardownTunnels(spy);
  });

  it("should initialize without sauceTunnelId with error", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      request: function (opts, cb) {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: function (cb) {
        cb();
      },
      clearTimeout: function () {},
      tunnel: {
        initialize: function (cb) {
          cb(new Error("foo"));
        }
      },
      analytics: {
        push: function () {}
      },
      sauceSettings: {
        useTunnels: true,
        maxTunnels: 5
      }
    });
    wa.initialize(spy);
  });

  it("should initialize without sauceTunnelId and get", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      request: {
        post: function (opts, cb) {
          expect(opts).to.not.be.null;
          cb(null, {}, JSON.stringify(
            {
              accepted: true,
              token: "foo"
            }
          ));
        }
      },
      setTimeout: function (cb) {
        cb();
      },
      clearTimeout: function () {},
      tunnel: {
        initialize: function (cb) {
          cb(null);
        },
        open: function (opts) {
          opts.callback(null, {});
        }
      },
      sauceSettings: {
        useTunnels: true,
        maxTunnels: 1,
        locksServerLocation: "foo"
      },
      settings: {
        debug: true
      }
    });
    wa.initialize(spy);
    wa.get(spy);
    wa.teardownTunnels(spy);
  });

  it("should initialize without sauceTunnelId and get", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, _settingsBuilder({
      request: {
        post: function (opts, cb) {
          expect(opts).to.not.be.null;
          cb(null, {}, JSON.stringify(
            {
              accepted: true,
              token: "foo"
            }
          ));
        }
      }
    }));
    wa.initialize(spy);
    wa.get(spy);
    wa.teardownTunnels(spy);
  });

  it("should initialize without sauceTunnelId and get without locksServerLocation", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      request: {
      },
      setTimeout: function (cb) {
        cb();
      },
      clearTimeout: function () {},
      tunnel: {
        initialize: function (cb) {
          cb(null);
        },
        open: function (opts) {
          opts.callback(null, {});
        }
      },
      sauceSettings: {
        useTunnels: true,
        maxTunnels: 1
      }
    });
    wa.initialize(spy);
    wa.get(spy);
    wa.teardownTunnels(spy);
  });

  it("should initialize without sauceTunnelId with bad payload", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, _settingsBuilder({
      request: {
        post: function (opts, cb) {
          expect(opts).to.not.be.null;
          cb(null, {}, "foo");
        }
      },
      sauceSettings: {
        useTunnels: true,
        maxTunnels: 1,
        locksServerLocation: "foo",
        locksOutageTimeout: 0
      }
    }));
    wa.initialize(spy);
    wa.get(spy);
  });

  it("should initialize without sauceTunnelId with err", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, _settingsBuilder({
      request: {
        post: function (opts, cb) {
          expect(opts).to.not.be.null;
          cb(new Error("Bad req"), {}, "foo");
        }
      },
      sauceSettings: {
        useTunnels: true,
        maxTunnels: 1,
        locksServerLocation: "foo",
        locksOutageTimeout: 0
      },
      settings: {
        debug: true
      }
    }));
    wa.initialize(spy);
    wa.get(spy);
  });

  it("should initialize without sauceTunnelId with null result", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, _settingsBuilder({
      request: {
        post: function (opts, cb) {
          expect(opts).to.not.be.null;
          cb(null, {}, "null");
        }
      },
      sauceSettings: {
        useTunnels: true,
        maxTunnels: 1,
        locksServerLocation: "foo",
        locksOutageTimeout: 0
      }
    }));
    wa.initialize(spy);
    wa.get(spy);
  });

  it("should initialize without sauceTunnelId with empty result", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, _settingsBuilder({
      request: {
        post: function (opts, cb) {
          expect(opts).to.not.be.null;
          cb(null, {}, "{}");
        }
      },
      sauceSettings: {
        useTunnels: true,
        maxTunnels: 1,
        locksServerLocation: "foo",
        locksOutageTimeout: 0
      }
    }));
    wa.initialize(spy);
  });

  it("should initialize without sauceTunnelId with empty result and debug", function () {
    var spy = sinon.spy();
    var wa = new WorkerAllocator(10, _settingsBuilder({
      request: {
        post: function (opts, cb) {
          expect(opts).to.not.be.null;
          cb(null, {}, "{}");
        }
      },
      sauceSettings: {
        useTunnels: true,
        maxTunnels: 1,
        locksServerLocation: "foo",
        locksOutageTimeout: 0
      },
      settings: {
        debug: true
      }
    }));
    wa.initialize(spy);
    wa.get(spy);
  });

  it("should initialize without sauceTunnelId with one good, one bad", function () {
    var spy = sinon.spy();
    var index = 0;
    var wa = new WorkerAllocator(10, {
      console: {
        log: function () {}
      },
      request: function (opts, cb) {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: function (cb) {
        cb();
      },
      clearTimeout: function () {},
      tunnel: {
        initialize: function (cb) {
          cb(null);
        },
        open: function (opts) {
          opts.callback(
            index === 1 ? new Error("bad tunnel") : null,
            {}
          );
          if (index === 0) {
            index = 1;
          }
        }
      },
      sauceSettings: {
        useTunnels: true,
        locksServerLocation: "foo",
        maxTunnels: 2
      }
    });
    wa.initialize(spy);
    wa.teardownTunnels(spy);
  });
});
