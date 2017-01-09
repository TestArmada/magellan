/* eslint no-undef: 0, no-unused-expressions: 0, no-invalid-this: 0,
  no-throw-literal: 0, no-empty: 0, camelcase: 0, no-unused-vars: 0 */
"use strict";
const expect = require("chai").expect;
const _ = require("lodash");
const Q = require("q");
const sinon = require("sinon");
const cli = require("../src/cli");

class FakeAllocator {
  constructor() {
  }
  initialize(cb) {
    cb(null);
  }
  teardown(cb) {
    cb();
  }
}

class FakeTestRunner {
  constructor(tests, opts) {
    this.tests = tests;
    this.opts = opts;
  }
  start() {
    this.opts.onSuccess();
  }
}

class FailingTestRunner {
  constructor(tests, opts) {
    this.tests = tests;
    this.opts = opts;
  }
  start() {
    this.opts.onFailure();
  }
}

class FakeReporter {
  initialize() {
    const defer = Q.defer();
    defer.resolve();
    return defer.promise;
  }
  listenTo() {
  }
  flush() {
    const defer = Q.defer();
    defer.resolve();
    return defer.promise;
  }
}

class BadReporter {
  initialize() {
    throw new Error("Bad!");
  }
  listenTo() {
  }
  flush() {
    const defer = Q.defer();
    defer.resolve();
    return defer.promise;
  }
}

const _fakeRequire = (overrides) => {
  return (name) => {
    if (overrides && overrides(name)) {
      return overrides(name);
    }
    if (name === "../package.json") {
      return {
        version: "1.2.3"
      };
    }
    if (name.match(/package.json/)) {
      return {
        name: "foobar",
        dependencies: [],
        devDependencies: []
      };
    }
    if (name === "./cli_help") {
      return {
        help: () => {}
      };
    }
    if (name === "./reporters/slack/settings") {
      return {};
    }
    if (name === "./reporters/slack/slack" ||
        name === "./reporters/screenshot_aggregator/reporter" ||
        name === "./reporters/stdout/reporter") {
      return new FakeReporter();
    }
    if (name.match(/\/index/)) {
      return {
        initialize: () => {},
        getPluginOptions: () => {}
      };
    }
    return {
    };
  };
};

const _testConfig = (overrides) => {
  return _.merge({
    console: {
      log: () => {},
      error: () => {}
    },
    require: _fakeRequire(),
    process: {
      cwd: () => {
        return "./";
      },
      exit: () => {
      }
    },
    analytics: {
      mark: () => {},
      push: () => {}
    },
    getTests: () => {
      return [
        {test: "a"},
        {test: "b"},
        {test: "c"}
      ];
    },
    margs: {
      init: () => {},
      argv: {
      }
    },
    settings: {
      framework: "foo"
    },
    processCleanup: (cb) => {
      cb();
    },
    path: {
      join: (a, b) => {
        const arr = [a, b];
        return arr.join("/");
      },
      resolve: (str) => {
        return str;
      }
    },
    SauceWorkerAllocator: FakeAllocator,
    WorkerAllocator: FakeAllocator,
    TestRunner: FakeTestRunner,
    browsers: {
      initialize: () => {
        const defer = Q.defer();
        defer.resolve();
        return defer.promise;
      }
    },
    testFilters: {
      detectFromCLI: () => {}
    },
    browserOptions: {
      detectFromCLI: () => {
        return [
          {browserId: "chrome", resolution: 1024, orientation: "portrait"},
          {browserId: "foo"}
        ];
      }
    }
  }, overrides);
};

describe("CLI", () => {
  it("startup", (done) => {
    const spy = sinon.spy();
    cli(_testConfig({
      console: {
        log: spy
      }
    })).then(() => {
      expect(spy.called).to.be.true;
      done();
    });
  });

  it("allow for config path", (done) => {
    let text = "";
    cli(_testConfig({
      yargs: {
        argv: {
          config: "FOOBAR_CONFIG"
        }
      },
      console: {
        log: (t) => {
          text += t;
        }
      }
    })).then(() => {
      expect(text.match(/FOOBAR_CONFIG/).length).to.eql(1);
      done();
    });
  });

  it("check for mocha", (done) => {
    cli(_testConfig({
      margs: {
        argv: {
          framework: "mocha"
        }
      },
      browserOptions: {
        detectFromCLI: (a, b, c) => {
          expect(c).to.be.true;
          return [
            {browserId: "chrome", resolution: 1024, orientation: "portrait"}
          ];
        }
      }
    })).then(() => {
      done();
    });
  });

  it("check for rowdy-mocha", (done) => {
    let sawRequire = false;
    cli(_testConfig({
      settings: {
        framework: "rowdy-mocha"
      },
      require: _fakeRequire((name) => {
        if (name === "./node_modules/testarmada-magellan-mocha-plugin/index") {
          sawRequire = true;
        }
      })
    })).then(() => {
      expect(sawRequire).to.be.true;
      done();
    });

    try {
      cli(_testConfig({
        settings: {
          framework: "rowdy-mocha"
        },
        require: _fakeRequire((name) => {
          if (name === "./node_modules/testarmada-magellan-mocha-plugin/index") {
            throw "Boom!";
          }
        })
      })).then(() => {
        expect(sawRequire).to.be.true;
        done();
      });
    } catch (e) {
    }
  });

  it("allow for sauce", (done) => {
    cli(_testConfig({
      margs: {
        argv: {
          sauce: true
        }
      },
      browsers: {
        initialize: (sauce) => {
          expect(sauce).to.be.true;
          const defer = Q.defer();
          defer.resolve();
          return defer.promise;
        }
      }
    })).then(() => {
      done();
    });
  });

  it("show help", (done) => {
    const spy = sinon.spy();
    cli(_testConfig({
      margs: {
        argv: {
          help: true
        }
      },
      require: _fakeRequire((name) => {
        if (name === "./cli_help") {
          return {
            help: spy
          };
        }
        return null;
      })
    })).then(() => {
      expect(spy.called).to.be.true;
      done();
    });
  });

  it("allow for no plugin options", (done) => {
    cli(_testConfig({
      require: _fakeRequire((name) => {
        if (name.match(/\/index/)) {
          return {
            initialize: () => {}
          };
        }
      })
    })).then(() => {
      done();
    });
  });

  it("throw an exception in initialization", (done) => {
    cli(_testConfig({
      require: _fakeRequire((name) => {
        if (name.match(/\/index/)) {
          return BadReporter;
        }
      })
    })).then(() => {
    }).catch(() => {
      done();
    });
  });

  it("allow for setup_teardown", (done) => {
    cli(_testConfig({
      margs: {
        argv: {
          setup_teardown: "hola!"
        }
      },
      loadRelativeModule: () => {
        return new FakeReporter();
      }
    })).then(() => {
      done();
    }).catch((e) => {
    });
  });

  it("allow for reporters", (done) => {
    cli(_testConfig({
      margs: {
        argv: {
          reporters: ["a", "b", "c"]
        }
      },
      loadRelativeModule: () => {
        return new FakeReporter();
      }
    })).then(() => {
      done();
    }).catch((e) => {
    });
  });

  it("allow for aggregateScreenshots", (done) => {
    cli(_testConfig({
      settings: {
        aggregateScreenshots: true
      },
      require: _fakeRequire((name) => {
        if (name === "./reporters/screenshot_aggregator/reporter") {
          return FakeReporter;
        }
      })
    })).then(() => {
      done();
    }).catch((e) => {
    });
  });

  it("allow for serial", (done) => {
    cli(_testConfig({
      margs: {
        argv: {
          serial: true
        }
      },
      require: _fakeRequire((name) => {
        if (name === "./reporters/stdout/reporter") {
          return FakeReporter;
        }
      })
    })).then(() => {
      done();
    }).catch((e) => {
    });
  });

  it("allow for serial and sauce", (done) => {
    cli(_testConfig({
      margs: {
        argv: {
          serial: true,
          sauce: true
        }
      },
      require: _fakeRequire((name) => {
        if (name === "./reporters/stdout/reporter") {
          return FakeReporter;
        }
      })
    })).then(() => {
      done();
    }).catch((e) => {
    });
  });

  it("allow for optional_reporters", (done) => {
    cli(_testConfig({
      margs: {
        argv: {
          optional_reporters: ["a", "b", "c"]
        }
      },
      loadRelativeModule: () => {
        return new FakeReporter();
      }
    })).then(() => {
      done();
    }).catch((e) => {
    });
  });

  it("allow for no browsers", (done) => {
    let called = false;
    cli(_testConfig({
      browserOptions: {
        detectFromCLI: () => {
          called = true;
          return null;
        }
      }
    })).then(() => {
    }).catch((e) => {
      expect(called).to.be.true;
      done();
    });
  });

  it("allow for zero browsers", (done) => {
    let called = false;
    cli(_testConfig({
      browserOptions: {
        detectFromCLI: () => {
          called = true;
          return [];
        }
      }
    })).then(() => {
    }).catch((e) => {
      expect(called).to.be.true;
      done();
    });
  });

  it("allow for just phantomjs", (done) => {
    let called = false;
    cli(_testConfig({
      browserOptions: {
        detectFromCLI: () => {
          called = true;
          return ["phantomjs"];
        }
      }
    })).then(() => {
      expect(called).to.be.true;
      done();
    }).catch((e) => {
    });
  });

  it("allow for debug", (done) => {
    cli(_testConfig({
      margs: {
        argv: {
          debug: true
        }
      },
      TestRunner: FakeTestRunner
    })).then(() => {
      done();
    }).catch((e) => {
    });
  });

  it("allow for no tests", (done) => {
    let called = false;
    cli(_testConfig({
      getTests: () => {
        called = true;
        return [];
      }
    })).then(() => {
    }).catch((e) => {
      expect(called).to.be.true;
      done();
    });
  });

  it("allow for failing worker", (done) => {
    cli(_testConfig({
      TestRunner: FailingTestRunner
    })).then(() => {
    }).catch((e) => {
      done();
    });
  });

  it("allow for bad WorkerAllocator", (done) => {
    cli(_testConfig({
      WorkerAllocator: FakeAllocator
    })).then(() => {
      done();
    }).catch((e) => {
    });
  });

  it("allow for bail_early", (done) => {
    cli(_testConfig({
      margs: {
        argv: {
          bail_early: true
        }
      },
      TestRunner: FakeTestRunner
    })).then(() => {
      done();
    }).catch((e) => {
    });
  });

  it("allow for bail_fast", (done) => {
    cli(_testConfig({
      margs: {
        argv: {
          bail_fast: true
        }
      },
      TestRunner: FakeTestRunner
    })).then(() => {
      done();
    }).catch((e) => {
    });
  });

  it("allow for slack initialization", (done) => {
    cli(_testConfig({
      require: _fakeRequire((name) => {
        if (name === "./reporters/slack/settings") {
          return {
            enabled: true
          };
        }
        if (name === "./reporters/slack/slack") {
          return FakeReporter;
        }
      })
    })).then(() => {
      done();
    }).catch((e) => {
    });
  });

  it("list browsers", (done) => {
    const spy = sinon.spy();
    cli(_testConfig({
      margs: {
        argv: {
          list_browsers: true
        }
      },
      browsers: {
        initialize: (a) => {
          expect(a).to.be.true;
          const defer = Q.defer();
          defer.resolve();
          return defer.promise;
        },
        listBrowsers: spy
      }
    })).then(() => {
      expect(spy.called).to.be.true;
      done();
    });
  });

  it("fail in list browsers", (done) => {
    cli(_testConfig({
      margs: {
        argv: {
          list_browsers: true
        }
      },
      browsers: {
        listBrowsers: () => {
          throw "Foo!";
        }
      }
    }))
    .then(() => {
    })
    .catch(() => {
      done();
    });
  });

  it("list browsers with device_additions", (done) => {
    const spy = sinon.spy();
    cli(_testConfig({
      margs: {
        argv: {
          list_browsers: true,
          device_additions: "hey"
        }
      },
      browsers: {
        initialize: (a) => {
          expect(a).to.be.true;
          const defer = Q.defer();
          defer.resolve();
          return defer.promise;
        },
        listBrowsers: spy,
        addDevicesFromFile: (f) => {
          expect(f).to.eql("hey");
        }
      }
    }))
    .then(() => {
      expect(spy.called).to.be.true;
      done();
    })
    .catch((err) => {
    });
  });

  it("deal with device_additions", (done) => {
    let called = false;
    cli(_testConfig({
      margs: {
        argv: {
          device_additions: "hey"
        }
      },
      browsers: {
        addDevicesFromFile: (f) => {
          called = true;
          expect(f).to.eql("hey");
        }
      }
    })).then(() => {
      expect(called).to.be.true;
      done();
    });
  });
});
