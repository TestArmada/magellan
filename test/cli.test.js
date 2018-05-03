"use strict";

const _ = require("lodash");

const cli = require("../src/cli.js");
const profiles = require("../src/profiles");
const settings = require('../src/settings');

jest.mock("../src/profiles");

describe("cli", () => {
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

  // it("get help", () => {
  //   return cli(_testConfig({
  //     margs: {
  //       argv: {
  //         help: true
  //       }
  //     }
  //   }))
  //     .then()
  //     .catch(err => assert(false, "shouldn't be here"));
  // });

  // it("setup_teardown", () => {
  //   return cli(_testConfig({
  //     margs: {
  //       argv: {
  //         setup_teardown: "something"
  //       }
  //     }
  //   }))
  //     .then()
  //     .catch(err => assert(false, "shouldn't be here"));
  // });



  // describe("resolve executor", () => {
  //   it("as string", () => {
  //     return cli(_testConfig({
  //       margs: {
  //         argv: {
  //           executors: "testarmada-magellan-local-executor"
  //         }
  //       }
  //     }))
  //       .then()
  //       .catch(err => assert(false, "shouldn't be here"));
  //   });

  //   it("as array", () => {
  //     return cli(_testConfig({
  //       margs: {
  //         argv: {
  //           executors: ["testarmada-magellan-local-executor"]
  //         }
  //       }
  //     }))
  //       .then()
  //       .catch(err => assert(false, "shouldn't be here"));
  //   });

  //   it("malformed", () => {
  //     return cli(_testConfig({
  //       margs: {
  //         argv: {
  //           executors: {}
  //         }
  //       }
  //     }))
  //       .then()
  //       .catch(err => assert(false, "shouldn't be here"));
  //   });

  //   it("executor method", () => {
  //     return cli(_testConfig({
  //       margs: {
  //         argv: {
  //           executors: ["testarmada-magellan-local-executor"],
  //           local_list_browsers: true
  //         }
  //       }
  //     }))
  //       .then()
  //       .catch(err => assert(false, "shouldn't be here"));
  //   });

  //   it("executor method no matches", () => {
  //     return cli(_testConfig({
  //       margs: {
  //         argv: {
  //           executors: ["testarmada-magellan-local-executor"],
  //           local_list_fakes: true
  //         }
  //       }
  //     }))
  //       .then()
  //       .catch(err => assert(false, "shouldn't be here"));
  //   });

  //   it("executor load exception", () => {
  //     return cli(_testConfig({
  //       margs: {
  //         argv: {
  //           executors: ["testarmada-magellan-local-executor"]
  //         }
  //       },
  //       require: _fakeRequire((name) => {
  //         if (name === "testarmada-magellan-local-executor") {
  //           throw new Error("FAKE EXECUTOR INIT ERROR");
  //         }
  //       })
  //     }))
  //       .then(() => assert(false, "shouldn't be here"))
  //       .catch(err => { });
  //   });
  // });

  // it("enable slack", () => {
  //   return cli(_testConfig({
  //     require: _fakeRequire((name) => {
  //       if (name === "./reporters/slack/settings") {
  //         return {
  //           enabled: true
  //         };
  //       }
  //       if (name === "./reporters/slack/slack") {
  //         return FakeReporter;
  //       }
  //     })
  //   }))
  //     .then()
  //     .catch(err => assert(false, "shouldn't be here"));
  // });

  // it("reporter as array", () => {
  //   return cli(_testConfig({
  //     margs: {
  //       argv: {
  //         reporters: ["a", "b", "c"]
  //       }
  //     },
  //     loadRelativeModule: () => {
  //       return new FakeReporter();
  //     }
  //   }))
  //     .then()
  //     .catch(err => assert(false, "shouldn't be here"));
  // });

  // it("allow optional reporter", () => {
  //   return cli(_testConfig({
  //     margs: {
  //       argv: {
  //         optional_reporters: ["a", "b", "c"]
  //       }
  //     },
  //     loadRelativeModule: () => {
  //       return new FakeReporter();
  //     }
  //   }))
  //     .then()
  //     .catch(err => assert(false, "shouldn't be here"));
  // });

  // it("enable serial", () => {
  //   return cli(_testConfig({
  //     margs: {
  //       argv: {
  //         serial: true
  //       }
  //     },
  //     require: _fakeRequire((name) => {
  //       if (name === "./reporters/stdout/reporter") {
  //         return FakeReporter;
  //       }
  //     })
  //   }))
  //     .then()
  //     .catch(err => assert(false, "shouldn't be here"));
  // });

  // it("enable screenshot", () => {
  //   return cli(_testConfig({
  //     settings: {
  //       aggregateScreenshots: true
  //     },
  //     require: _fakeRequire((name) => {
  //       if (name === "./reporters/screenshot_aggregator/reporter") {
  //         return FakeReporter;
  //       }
  //     })
  //   }))
  //     .then()
  //     .catch(err => assert(false, "shouldn't be here"));
  // });

  // it("allow no test", () => {
  //   return cli(_testConfig({
  //     getTests: () => {
  //       return [];
  //     }
  //   }))
  //     .then(() => assert(false, "shouldn't be here"))
  //     .catch(err => { });
  // });

  // it("allow worker error", () => {
  //   return cli(_testConfig({
  //     WorkerAllocator: class InvalidWorkerAllocator {
  //       constructor() {
  //       }
  //       initialize(cb) {
  //         cb("FAKE_ERROR");
  //       }
  //       teardown(cb) {
  //         cb();
  //       }
  //     }
  //   }))
  //     .then(() => assert(false, "shouldn't be here"))
  //     .catch(err => { });
  // });

  // it("executor teardownRunner error", () => {
  //   return cli(_testConfig({
  //     margs: {
  //       argv: {
  //         executors: ["testarmada-magellan-local-executor"]
  //       }
  //     },
  //     require: _fakeRequire((name) => {
  //       if (name === "testarmada-magellan-local-executor") {
  //         return {
  //           name: "testarmada-magellan-local-executor",
  //           shortName: "local",
  //           help: {
  //             "local_list_browsers": {
  //               "visible": true,
  //               "type": "function",
  //               "description": "List the available browsers configured."
  //             },
  //             "local_list_fakes": {
  //               "visible": true,
  //               "type": "function",
  //               "description": "List the available browsers configured."
  //             }
  //           },
  //           validateConfig() { },
  //           setupRunner() {
  //             return new Promise((resolve) => {
  //               resolve();
  //             });
  //           },
  //           teardownRunner() {
  //             return new Promise((resolve, reject) => {
  //               reject("FAKE_ERROR");
  //             });
  //           },
  //           listBrowsers(param, callback) {
  //             callback();
  //           }
  //         }
  //       }
  //     })
  //   }))
  //     .then(() => assert(false, "shouldn't be here"))
  //     .catch(err => { });
  // });

  // it("runner on failure", () => {
  //   return cli(_testConfig({
  //     TestRunner: class InvalidRunner {
  //       constructor(tests, opts) {
  //         this.tests = tests;
  //         this.opts = opts;
  //       }
  //       start() {
  //         this.opts.onFailure();
  //       }
  //     }
  //   }))
  //     .then(() => assert(false, "shouldn't be here"))
  //     .catch(err => { });
  // });

  // it("executor teardownRunner error with onFailure", () => {
  //   return cli(_testConfig({
  //     TestRunner: class InvalidRunner {
  //       constructor(tests, opts) {
  //         this.tests = tests;
  //         this.opts = opts;
  //       }
  //       start() {
  //         this.opts.onFailure();
  //       }
  //     },
  //     margs: {
  //       argv: {
  //         executors: ["testarmada-magellan-local-executor"]
  //       }
  //     },
  //     require: _fakeRequire((name) => {
  //       if (name === "testarmada-magellan-local-executor") {
  //         return {
  //           name: "testarmada-magellan-local-executor",
  //           shortName: "local",
  //           help: {
  //             "local_list_browsers": {
  //               "visible": true,
  //               "type": "function",
  //               "description": "List the available browsers configured."
  //             },
  //             "local_list_fakes": {
  //               "visible": true,
  //               "type": "function",
  //               "description": "List the available browsers configured."
  //             }
  //           },
  //           validateConfig() { },
  //           setupRunner() {
  //             return new Promise((resolve) => {
  //               resolve();
  //             });
  //           },
  //           teardownRunner() {
  //             return new Promise((resolve, reject) => {
  //               reject("FAKE_ERROR");
  //             });
  //           },
  //           listBrowsers(param, callback) {
  //             callback();
  //           }
  //         }
  //       }
  //     })
  //   }))
  //     .then(() => assert(false, "shouldn't be here"))
  //     .catch(err => { });
  // });
});