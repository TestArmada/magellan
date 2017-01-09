/* eslint no-undef: 0, no-magic-numbers: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const WorkerAllocator = require("../../src/sauce/worker_allocator");
const sinon = require("sinon");
const _ = require("lodash");

const _settingsBuilder = (extra) => {
  return _.merge({
    console: {log: () => {}},
    setTimeout: (cb) => {cb();},
    clearTimeout: () => {},
    tunnel: {
      initialize: (cb) => {
        cb(null);
      },
      open: (opts) => {
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

describe("sauce/worker_allocator", () => {
  it("should create", () => {
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      sauceSettings: {
        locksServerLocation: "foo/"
      }
    });
    expect(wa.tunnelPrefix).to.not.be.null;
  });

  it("should create without sauceSettings", () => {
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      }
    });
    expect(wa.tunnelPrefix).to.not.be.null;
  });

  it("should release", () => {
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      request: (opts, cb) => {
        expect(opts).to.not.be.null;
        cb();
      },
      sauceSettings: {
        locksServerLocation: "foo/"
      }
    });
    wa.release(wa.workers[0]);
  });

  it("should release without server loc", () => {
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      request: (opts, cb) => {
        expect(opts).to.not.be.null;
        cb();
      },
      sauceSettings: {
      }
    });
    wa.release(wa.workers[0]);
  });

  it("should teardown", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      request: (opts, cb) => {
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

  it("should teardown with tunnels", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      request: (opts, cb) => {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: (cb) => {
        cb();
      },
      clearTimeout: () => {},
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

  it("should initialize with nothing", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      request: (opts, cb) => {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: (cb) => {
        cb();
      },
      clearTimeout: () => {},
      sauceSettings: {
      },
      settings: {
        debug: true
      }
    });
    wa.initialize(spy);
    expect(spy.called).to.be.true;
  });

  it("should initialize with sauceTunnelId", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      request: (opts, cb) => {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: (cb) => {
        cb();
      },
      clearTimeout: () => {},
      sauceSettings: {
        sauceTunnelId: 52
      }
    });
    wa.initialize(spy);
    expect(spy.called).to.be.true;
  });

  it("should initialize without sauceTunnelId", (done) => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      request: (opts, cb) => {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: (cb) => {
        cb();
      },
      clearTimeout: () => {},
      tunnel: {
        initialize: (cb) => {
          cb(null);
        },
        open: (opts) => {
          opts.callback(null, {});
        },
        close: (tunnel, cb) => {
          cb();
        }
      },
      sauceSettings: {
        useTunnels: true,
        maxTunnels: 2
      },
      delay: (cb) => {
        cb();
      }
    });
    wa.initialize(() => {
      wa.teardownTunnels(spy);
      done();
    });
  });

  it("should initialize without sauceTunnelId with tunnel error", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      request: (opts, cb) => {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: (cb) => {
        cb();
      },
      clearTimeout: () => {},
      tunnel: {
        initialize: (cb) => {
          cb(null);
        },
        open: (opts) => {
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

  it("should initialize without sauceTunnelId with error", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      request: (opts, cb) => {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: (cb) => {
        cb();
      },
      clearTimeout: () => {},
      tunnel: {
        initialize: (cb) => {
          cb(new Error("foo"));
        }
      },
      analytics: {
        push: () => {}
      },
      sauceSettings: {
        useTunnels: true,
        maxTunnels: 5
      }
    });
    wa.initialize(spy);
  });

  it("should initialize without sauceTunnelId and get", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      request: {
        post: (opts, cb) => {
          expect(opts).to.not.be.null;
          cb(null, {}, JSON.stringify(
            {
              accepted: true,
              token: "foo"
            }
          ));
        }
      },
      setTimeout: (cb) => {
        cb();
      },
      clearTimeout: () => {},
      tunnel: {
        initialize: (cb) => {
          cb(null);
        },
        open: (opts) => {
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

  it("should initialize without sauceTunnelId and get", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, _settingsBuilder({
      request: {
        post: (opts, cb) => {
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

  it("should initialize without sauceTunnelId and get without locksServerLocation", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      request: {
      },
      setTimeout: (cb) => {
        cb();
      },
      clearTimeout: () => {},
      tunnel: {
        initialize: (cb) => {
          cb(null);
        },
        open: (opts) => {
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

  it("should initialize without sauceTunnelId with bad payload", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, _settingsBuilder({
      request: {
        post: (opts, cb) => {
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

  it("should initialize without sauceTunnelId with err", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, _settingsBuilder({
      request: {
        post: (opts, cb) => {
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

  it("should initialize without sauceTunnelId with null result", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, _settingsBuilder({
      request: {
        post: (opts, cb) => {
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

  it("should initialize without sauceTunnelId with empty result", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, _settingsBuilder({
      request: {
        post: (opts, cb) => {
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

  it("should initialize without sauceTunnelId with empty result and debug", () => {
    const spy = sinon.spy();
    const wa = new WorkerAllocator(10, _settingsBuilder({
      request: {
        post: (opts, cb) => {
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

  it("should initialize without sauceTunnelId with one good, one bad", () => {
    const spy = sinon.spy();
    let index = 0;
    const wa = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      request: (opts, cb) => {
        expect(opts).to.not.be.null;
        cb();
      },
      setTimeout: (cb) => {
        cb();
      },
      clearTimeout: () => {},
      tunnel: {
        initialize: (cb) => {
          cb(null);
        },
        open: (opts) => {
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
