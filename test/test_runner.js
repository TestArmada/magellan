/* eslint no-undef: 0, no-invalid-this: 0, no-magic-numbers: 0, no-unused-expressions: 0,
  no-throw-literal: 0 */
"use strict";
const expect = require("chai").expect;
const _ = require("lodash");
const EventEmitter = require("events").EventEmitter;
const sinon = require("sinon");

const TestRunner = require("../src/test_runner");

class BadTestRun {
  getEnvironment() {
    throw new Error("foo");
  }
  getCommand() {
    return "command";
  }
  getArguments() {
    return "args";
  }
}

class FakeTestRun {
  getEnvironment() {
    return "foo";
  }
  getCommand() {
    return "command";
  }
  getArguments() {
    return "args";
  }
}

class MockIO extends EventEmitter {
  constructor() {
    super();
  }
  unpipe() {
  }
}

class MockChildProcess extends EventEmitter {
  constructor() {
    super();
    this.stdout = new MockIO();
    this.stdout.setMaxListeners(50);
    this.stderr = new MockIO();
    this.stderr.setMaxListeners(50);
  }
  removeAllListeners() {
  }
}

const _testStruct = (moreOpts) => {
  return _.merge({
    testLocator: "baz",
    stopClock: () => {},
    startClock: () => {},
    getRuntime: () => {return 20;},
    fail: () => {},
    browser: {
      browserId: "chrome"
    },
    locator: "bar",
    status: 3,
    canRun: () => {
      return true;
    }
  }, moreOpts);
};

const _tests = () => {
  return [
    {test: "foo", locator: "bar"},
    {test: "bar", locator: "bar"},
    {test: "baz", locator: "bar"}
  ];
};

const _options = (moreOpts) => {
  return _.merge({
    browsers: [{
      browserId: "chrome",
      resolution: 2000,
      orientation: "portrait"
    }],
    allocator: {
      get: (cb) => {
        cb(null, {index: 0, tunnelId: 50, token: "foo"});
      },
      release: () => {}
    },
    listeners: [
      {
        listenTo: () => {}
      },
      {
        listenTo: () => {},
        flush: () => {}
      },
      {
        listenTo: () => {},
        flush: () => {
          return {
            then: () => {
              return {
                catch: (cb) => { cb({}); }
              };
            }
          };
        }
      }
    ],
    sauceSettings: {
      user: "Jack"
    }
  }, moreOpts);
};

const _testOptions = (moreOpts) => {
  return _.merge({
    console: {
      log: () => {},
      error: () => {}
    },
    fs: {
      readFileSync: () => {
        return JSON.stringify({failures: {
          foo: 1,
          baz: 2
        }});
      },
      writeFileSync: () => {}
    },
    mkdirSync: () => {},
    fork: () => {
      const m = new MockChildProcess();
      m.setMaxListeners(50);
      return m;
    },
    sauceBrowsers: {
      browser: () => {
        return {foo: 1};
      }
    },
    settings: {
      testFramework: {
        TestRun: FakeTestRun
      },
      tempDir: "foo",
      buildId: "buildId-bar"
    },
    clearInterval: () => {},
    setTimeout: (cb) => { cb(); },
    setInterval: (cb) => { cb(); },
    prettyMs: () => {return "";}
  }, moreOpts);
};

describe("TestRunner Class", () => {
  it("should initialize", () => {
    const tr = new TestRunner(_tests(), _options({}), _testOptions({}));
    expect(tr).to.be.not.be.null;
  });

  it("should initialize with bail options", () => {
    const tr1 = new TestRunner(_tests(), _options({bailFast: true}), _testOptions({}));
    expect(tr1).to.be.not.be.null;
    expect(tr1.strictness).to.eql(4);

    const tr2 = new TestRunner(_tests(), _options({bailOnThreshold: 3}), _testOptions({}));
    expect(tr2).to.be.not.be.null;
    expect(tr2.strictness).to.eql(3);

    const tr3 = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        bailTimeExplicitlySet: 1000
      }
    }));
    expect(tr3).to.be.not.be.null;
    expect(tr3.strictness).to.eql(2);
  });

  it("should initialize with trends", () => {
    const tr = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        gatherTrends: true
      }
    }));
    expect(tr).to.be.not.be.null;
    expect(tr.trends).to.eql({failures: {}});
  });

  it("should start", () => {
    const tr1 = new TestRunner(_tests(), _options(), _testOptions({}));
    tr1.start();
    expect(tr1.startTime).to.not.be.null;

    // Test serial
    const tr2 = new TestRunner(_tests(), _options({
      serial: true
    }), _testOptions({}));
    tr2.start();
    expect(tr2.startTime).to.not.be.null;

    // Test no tests
    const tr3 = new TestRunner([], _options({}), _testOptions({}));
    tr3.start();
    expect(tr3.startTime).to.not.be.null;
  });

  it("should idle", () => {
    const tr1 = new TestRunner(_tests(), _options(), _testOptions({}));
    tr1.notIdle();
    expect(tr1.busyCount).to.eql(1);
    tr1.notIdle();
    expect(tr1.busyCount).to.eql(2);
    tr1.notIdle();
    expect(tr1.busyCount).to.eql(3);
    tr1.maybeIdle();
    expect(tr1.busyCount).to.eql(2);
    tr1.maybeIdle();
    expect(tr1.busyCount).to.eql(1);
    tr1.maybeIdle();
    expect(tr1.busyCount).to.eql(0);
  });

  it("should run a test", () => {
    const spy1 = sinon.spy();
    const tr1 = new TestRunner(_tests(), _options(), _testOptions({
      analytics: {
        push: spy1,
        mark: spy1
      }
    }));
    tr1.stageTest(_testStruct(), () => {});
    expect(spy1.called).to.be.true;
  });

  it("should fail on a bad worker allocation", (done) => {
    // Uncle Owen! This one"s got a bad motivator!
    const spy = sinon.spy();
    const test = {
      fail: spy
    };
    const tr = new TestRunner(_tests(), _options({
      allocator: {
        get: (cb) => {
          cb({bad: "stuff"});
        }
      }
    }), _testOptions({}));
    tr.stageTest(_testStruct(test), () => {
      expect(spy.called).to.be.true;
      done();
    });
  });

  it("should run through a passing test", (done) => {
    const myMock = new MockChildProcess();
    myMock.setMaxListeners(50);
    const spy = sinon.spy();
    const tr = new TestRunner(_tests(), _options({
      listeners: [
        {}
      ],
      debug: true
    }), _testOptions({
      fork: () => {
        return myMock;
      },
      settings: {
        gatherTrends: true
      }
    }));
    tr.stageTest(_testStruct({
      pass: spy
    }), () => {
      expect(spy.called).to.be.true;

      tr.trends.failures = {
        fooz: 1,
        bar: 2,
        baz: 3
      };
      tr.gatherTrends();
      tr.logFailedTests();
      tr.summarizeCompletedBuild();

      done();
    });

    myMock.emit("message", {sessionId: 52});
    myMock.emit("message", {type: "selenium-session-info", sessionId: 52});
    myMock.stdout.emit("data", "");
    myMock.stdout.emit("data", "Lotsa love");
    myMock.stdout.emit("data", "Lotsa love\n2");
    myMock.stderr.emit("data", "");
    myMock.stderr.emit("data", "Notso lotsa love");
    myMock.stderr.emit("data", "Notso lotsa love\n2");
    myMock.emit("close", 0);
  });

  it("should run through a passing test w/o debugging", (done) => {
    const myMock = new MockChildProcess();
    myMock.setMaxListeners(50);
    const spy = sinon.spy();
    const tr = new TestRunner(_tests(), _options({
      listeners: [
        {}
      ]
    }), _testOptions({
      fork: () => {
        return myMock;
      },
      settings: {
        gatherTrends: true
      }
    }));
    tr.stageTest(_testStruct({
      pass: spy
    }), () => {
      expect(spy.called).to.be.true;

      tr.gatherTrends();
      tr.logFailedTests();
      tr.summarizeCompletedBuild();
      done();
    });

    myMock.emit("message", {sessionId: 52});
    myMock.emit("message", {type: "selenium-session-info", sessionId: 52});
    myMock.emit("close", 0);
  });

  it("should report failed tests", () => {
    const spy = sinon.spy();
    let text = "";
    const tr = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        gatherTrends: true
      },
      console: {
        log: (t) => {
          text += t;
        }
      },
      fs: {
        writeFileSync: spy
      }
    }));
    tr.failedTests = [
      {
        stdout: "---FOOOZ---",
        stderr: "---BAAAZ---"
      }
    ];
    tr.gatherTrends();
    tr.logFailedTests();
    tr.summarizeCompletedBuild();

    expect(spy.called).to.be.true;
    expect(text.match(/---FOOOZ---/).length).to.eql(1);
    expect(text.match(/---BAAAZ---/).length).to.eql(1);
  });

  it("should handle failed tests", (done) => {
    const myMock = new MockChildProcess();
    myMock.setMaxListeners(50);
    const spy = sinon.spy();
    const tr = new TestRunner(_tests(), _options(), _testOptions({
      fork: () => {
        return myMock;
      },
      settings: {
        gatherTrends: true
      }
    }));
    tr.stageTest(_testStruct({
      fail: spy
    }), () => {
      expect(spy.called).to.be.true;
      tr.gatherTrends();
      tr.logFailedTests();
      tr.summarizeCompletedBuild();
      done();
    });
    myMock.emit("close", -1);
  });

  it("should handle inability to get test environment", (done) => {
    const spy = sinon.spy();
    const tr = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        testFramework: {
          TestRun: BadTestRun
        }
      }
    }));
    tr.stageTest(_testStruct({
      fail: spy
    }), () => {
      expect(spy.called).to.be.true;
      done();
    });
  });

  it("should handle inability to fork", (done) => {
    const spy = sinon.spy();
    const tr = new TestRunner(_tests(), _options(), _testOptions({
      fork: () => {
        throw new Error("Nope!");
      }
    }));
    tr.stageTest(_testStruct({
      fail: spy
    }), () => {
      expect(spy.called).to.be.true;
      done();
    });
  });

  it("should handle throwing in listenTo", () => {
    const spy = sinon.spy();
    const tr = new TestRunner(_tests(), _options({
      listeners: [
        {
          listenTo: () => {
            throw "Whoops!";
          }
        }
      ]
    }), _testOptions());
    tr.stageTest(_testStruct({
      fail: spy
    }), () => {
      expect(spy.called).to.be.true;
      // Not sure this is actually correct behavior. A throw in a listener is not a test failure.
      done();
    });
  });

  it("should handle bailing", () => {
    const myMock = new MockChildProcess();
    myMock.setMaxListeners(50);
    const tr = new TestRunner(_tests(), _options({
      bailOnThreshold: 1
    }), _testOptions({
      fork: () => {
        return myMock;
      },
      settings: {
        gatherTrends: true
      }
    }));
    tr.stageTest(_testStruct(), () => {});
    myMock.emit("close", -1);
    myMock.emit("close", -1);
    myMock.emit("close", -1);

    expect(tr.shouldBail()).to.be.false;
    tr.passedTests = [{attempts: 2}, {attempts: 1}];
    expect(tr.shouldBail()).to.be.false;
    tr.failedTests = [{attempts: 2}, {attempts: 1}];
    expect(tr.shouldBail()).to.be.false;
    tr.failedTests = [{attempts: 20}, {attempts: 25}];
    expect(tr.shouldBail()).to.be.true;

    tr.gatherTrends();
    tr.logFailedTests();
    tr.summarizeCompletedBuild();
  });

  it("should have bail fast logic", () => {
    const tr = new TestRunner(_tests(), _options({
      bailFast: true
    }), _testOptions({}));

    expect(tr.shouldBail()).to.be.false;
    tr.passedTests = [{attempts: 2}, {attempts: 1}];
    expect(tr.shouldBail()).to.be.false;
    tr.failedTests = [{attempts: 2}, {attempts: 1}];
    expect(tr.shouldBail()).to.be.true;
  });

  it("should have bail fast logic", () => {
    const tr = new TestRunner(_tests(), _options({
      bailFast: true
    }), _testOptions({}));

    expect(tr.shouldBail()).to.be.false;
    tr.passedTests = [{attempts: 2}, {attempts: 1}];
    expect(tr.shouldBail()).to.be.false;
    tr.failedTests = [{attempts: 2}, {attempts: 1}];
    expect(tr.shouldBail()).to.be.true;

    tr.hasBailed = false;
    tr.checkBuild();
  });

  it("should have bail early logic", () => {
    const tr = new TestRunner(_tests(), _options({
      bailOnThreshold: 1
    }), _testOptions({}));

    expect(tr.shouldBail()).to.be.false;
    tr.passedTests = [{attempts: 2}, {attempts: 1}];
    expect(tr.shouldBail()).to.be.false;
    tr.failedTests = [{attempts: 25}, {attempts: 26}];
    expect(tr.shouldBail()).to.be.true;
  });

  it("should summarize under constious circumnstances", () => {
    let text = "";
    const tr = new TestRunner(_tests(), _options(), _testOptions({
      console: {
        log: (t) => {
          text += t;
        }
      }
    }));

    tr.summarizeCompletedBuild();
    expect(text.match(/BAILED/)).to.be.null;

    text = "";
    tr.hasBailed = true;
    tr.summarizeCompletedBuild();
    expect(text.match(/BAILED/).length).to.eql(1);

    text = "";
    tr.tests = [
      {status: 0},
      {status: 3, getRetries: () => { return 0; }},
      {status: 3, getRetries: () => { return 1; }},
      {status: 3, getRetries: () => { return 1; }}
    ];
    tr.summarizeCompletedBuild();
    expect(text.match(/Skipped: 3/).length).to.eql(1);
  });

  it("should handle constious forms of test completion", () => {
    let text = "";
    const tr1 = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        gatherTrends: true
      },
      console: {
        log: (t) => {
          text += t;
        }
      }
    }));

    text = "";
    tr1.hasBailed = true;
    tr1.onTestComplete(new Error("foo"), _testStruct());
    expect(text.match(/KILLED/).length).to.eql(1);

    tr1.hasBailed = false;
    tr1.onTestComplete(new Error("foo"), _testStruct({
      status: 0
    }));
    expect(tr1.passedTests.length).to.eql(0);

    tr1.hasBailed = false;
    tr1.onTestComplete(new Error("foo"), _testStruct({
      status: 3
    }));
    expect(tr1.passedTests.length).to.eql(1);

    text = "";
    tr1.serial = true;
    tr1.onTestComplete(new Error("foo"), _testStruct({
      status: 3
    }));
    expect(text.match(/worker/)).to.be.null;

    const tr2 = new TestRunner(_tests(), _options(), _testOptions());
    tr2.onTestComplete(new Error("foo"), _testStruct({
      status: 0
    }));
    expect(tr2.failedTests.length).to.eql(1);

    tr2.onTestComplete(new Error("foo"), _testStruct({
      status: 0,
      canRun: () => { return false; }
    }));
    expect(tr2.failedTests.length).to.eql(2);
  });
});
