"use strict";

const chai = require("chai");
const chaiAsPromise = require("chai-as-promised");
const _ = require("lodash");

const cli = require("../src/cli.js");
const logger = require("../src/logger");

chai.use(chaiAsPromise);

const expect = chai.expect;
const assert = chai.assert;

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
        help: () => { }
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
    if (name === "testarmada-magellan-local-executor") {
      return fakeExecutor;
    }
    if (name.indexOf("error") > -1) {
      throw new Error("FAKE FRAMEWORK EXCEPTION");
    }

    if (name.match(/\/index/)) {
      return {
        initialize: () => { },
        getPluginOptions: () => { }
      };
    }
    return {
    };
  }
};

const fakeExecutor = {
  name: "testarmada-magellan-local-executor",
  shortName: "local",
  help: {
    "local_list_browsers": {
      "visible": true,
      "type": "function",
      "description": "List the available browsers configured."
    },
    "local_list_fakes": {
      "visible": true,
      "type": "function",
      "description": "List the available browsers configured."
    }
  },
  validateConfig() { },
  setupRunner() {
    return new Promise((resolve) => {
      resolve();
    });
  },
  teardownRunner() {
    return new Promise((resolve) => {
      resolve();
    });
  },
  listBrowsers(param, callback) {
    callback();
  }
};

const FakeProfiles = {
  detectFromCLI() {
    return new Promise((resolve) => {
      resolve([{ executor: "local" }]);
    });
  }
};

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

class FakeReporter {
  initialize() {
    return new Promise((resolve) => { resolve() });
  }
  listenTo() {
  }
  flush() {
    return new Promise((resolve) => { resolve() });
  }
}

const _testConfig = (overrides) => {
  return _.merge({
    console: {
      log: () => { },
      error: () => { }
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
      mark: () => { },
      push: () => { }
    },
    getTests: () => {
      return [
        { test: "a" },
        { test: "b" },
        { test: "c" }
      ];
    },
    margs: {
      init: () => { },
      argv: {
        debug: true
      }
    },
    settings: {
      framework: "foo",
      testExecutors: {
        "local": fakeExecutor
      }
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
    WorkerAllocator: FakeAllocator,
    TestRunner: FakeTestRunner,
    profiles: FakeProfiles,
    testFilters: {
      detectFromCLI: () => { }
    },
    loadRelativeModule: () => { return new FakeReporter(); }
  }, overrides);
};

describe("pure_cli", () => {
  it("allow for config path", () => {
    return cli(_testConfig({
      yargs: {
        argv: {
          config: "FOOBAR_CONFIG"
        }
      }
    }))
      .then()
      .catch(err => assert(false, "shouldn't be here"));
  });

  describe("resolve framework", () => {
    it("legacy framework name translation", () => {
      return cli(_testConfig({
        settings: {
          framework: "vanilla-mocha"
        }
      }))
        .then()
        .catch(err => assert(false, "shouldn't be here"));
    });

    it("handle framework load exception", () => {
      return cli(_testConfig({
        settings: {
          framework: "error"
        }
      }))
        .then(() => assert(false, "shouldn't be here"))
        .catch(err => { });
    });

    it("handle framework init exception", () => {
      return cli(_testConfig({
        settings: {
          framework: "local"
        },
        require: _fakeRequire((name) => {
          if (name.match(/\/index/)) {
            return {
              initialize: () => { },
              getPluginOptions: () => { throw new Error("FAKE INIT ERROR") }
            };
          }
        })
      }))
        .then(() => assert(false, "shouldn't be here"))
        .catch(err => { });
    });
  });

  it("get help", () => {
    return cli(_testConfig({
      margs: {
        argv: {
          help: true
        }
      }
    }))
      .then()
      .catch(err => assert(false, "shouldn't be here"));
  });

  it("setup_teardown", () => {
    return cli(_testConfig({
      margs: {
        argv: {
          setup_teardown: "something"
        }
      }
    }))
      .then()
      .catch(err => assert(false, "shouldn't be here"));
  });



  describe("resolve executor", () => {
    it("as string", () => {
      return cli(_testConfig({
        margs: {
          argv: {
            executors: "testarmada-magellan-local-executor"
          }
        }
      }))
        .then()
        .catch(err => assert(false, "shouldn't be here"));
    });

    it("as array", () => {
      return cli(_testConfig({
        margs: {
          argv: {
            executors: ["testarmada-magellan-local-executor"]
          }
        }
      }))
        .then()
        .catch(err => assert(false, "shouldn't be here"));
    });

    it("malformed", () => {
      return cli(_testConfig({
        margs: {
          argv: {
            executors: {}
          }
        }
      }))
        .then()
        .catch(err => assert(false, "shouldn't be here"));
    });

    it("executor method", () => {
      return cli(_testConfig({
        margs: {
          argv: {
            executors: ["testarmada-magellan-local-executor"],
            local_list_browsers: true
          }
        }
      }))
        .then()
        .catch(err => assert(false, "shouldn't be here"));
    });

    it("executor method no matches", () => {
      return cli(_testConfig({
        margs: {
          argv: {
            executors: ["testarmada-magellan-local-executor"],
            local_list_fakes: true
          }
        }
      }))
        .then()
        .catch(err => assert(false, "shouldn't be here"));
    });

    it("executor load exception", () => {
      return cli(_testConfig({
        margs: {
          argv: {
            executors: ["testarmada-magellan-local-executor"]
          }
        },
        require: _fakeRequire((name) => {
          if (name === "testarmada-magellan-local-executor") {
            throw new Error("FAKE EXECUTOR INIT ERROR");
          }
        })
      }))
        .then(() => assert(false, "shouldn't be here"))
        .catch(err => { });
    });
  });

  it("enable slack", () => {
    return cli(_testConfig({
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
    }))
      .then()
      .catch(err => assert(false, "shouldn't be here"));
  });

  it("reporter as array", () => {
    return cli(_testConfig({
      margs: {
        argv: {
          reporters: ["a", "b", "c"]
        }
      },
      loadRelativeModule: () => {
        return new FakeReporter();
      }
    }))
      .then()
      .catch(err => assert(false, "shouldn't be here"));
  });

  it("allow optional reporter", () => {
    return cli(_testConfig({
      margs: {
        argv: {
          optional_reporters: ["a", "b", "c"]
        }
      },
      loadRelativeModule: () => {
        return new FakeReporter();
      }
    }))
      .then()
      .catch(err => assert(false, "shouldn't be here"));
  });

  it("enable serial", () => {
    return cli(_testConfig({
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
    }))
      .then()
      .catch(err => assert(false, "shouldn't be here"));
  });

  it("enable screenshot", () => {
    return cli(_testConfig({
      settings: {
        aggregateScreenshots: true
      },
      require: _fakeRequire((name) => {
        if (name === "./reporters/screenshot_aggregator/reporter") {
          return FakeReporter;
        }
      })
    }))
      .then()
      .catch(err => assert(false, "shouldn't be here"));
  });

  it("allow no test", () => {
    return cli(_testConfig({
      getTests: () => {
        return [];
      }
    }))
      .then(() => assert(false, "shouldn't be here"))
      .catch(err => { });
  });

  it("allow worker error", () => {
    return cli(_testConfig({
      WorkerAllocator: class InvalidWorkerAllocator {
        constructor() {
        }
        initialize(cb) {
          cb("FAKE_ERROR");
        }
        teardown(cb) {
          cb();
        }
      }
    }))
      .then(() => assert(false, "shouldn't be here"))
      .catch(err => { });
  });

  it("executor teardownRunner error", () => {
    return cli(_testConfig({
      margs: {
        argv: {
          executors: ["testarmada-magellan-local-executor"]
        }
      },
      require: _fakeRequire((name) => {
        if (name === "testarmada-magellan-local-executor") {
          return {
            name: "testarmada-magellan-local-executor",
            shortName: "local",
            help: {
              "local_list_browsers": {
                "visible": true,
                "type": "function",
                "description": "List the available browsers configured."
              },
              "local_list_fakes": {
                "visible": true,
                "type": "function",
                "description": "List the available browsers configured."
              }
            },
            validateConfig() { },
            setupRunner() {
              return new Promise((resolve) => {
                resolve();
              });
            },
            teardownRunner() {
              return new Promise((resolve, reject) => {
                reject("FAKE_ERROR");
              });
            },
            listBrowsers(param, callback) {
              callback();
            }
          }
        }
      })
    }))
      .then(() => assert(false, "shouldn't be here"))
      .catch(err => { });
  });

  it("runner on failure", () => {
    return cli(_testConfig({
      TestRunner: class InvalidRunner {
        constructor(tests, opts) {
          this.tests = tests;
          this.opts = opts;
        }
        start() {
          this.opts.onFailure();
        }
      }
    }))
      .then(() => assert(false, "shouldn't be here"))
      .catch(err => { });
  });

  it("executor teardownRunner error with onFailure", () => {
    return cli(_testConfig({
      TestRunner: class InvalidRunner {
        constructor(tests, opts) {
          this.tests = tests;
          this.opts = opts;
        }
        start() {
          this.opts.onFailure();
        }
      },
      margs: {
        argv: {
          executors: ["testarmada-magellan-local-executor"]
        }
      },
      require: _fakeRequire((name) => {
        if (name === "testarmada-magellan-local-executor") {
          return {
            name: "testarmada-magellan-local-executor",
            shortName: "local",
            help: {
              "local_list_browsers": {
                "visible": true,
                "type": "function",
                "description": "List the available browsers configured."
              },
              "local_list_fakes": {
                "visible": true,
                "type": "function",
                "description": "List the available browsers configured."
              }
            },
            validateConfig() { },
            setupRunner() {
              return new Promise((resolve) => {
                resolve();
              });
            },
            teardownRunner() {
              return new Promise((resolve, reject) => {
                reject("FAKE_ERROR");
              });
            },
            listBrowsers(param, callback) {
              callback();
            }
          }
        }
      })
    }))
      .then(() => assert(false, "shouldn't be here"))
      .catch(err => { });
  });
});