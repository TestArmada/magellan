/* eslint no-undef: 0, no-invalid-this: 0, no-magic-numbers: 0, no-unused-expressions: 0,
  no-throw-literal: 0 */
"use strict";
var expect = require("chai").expect;
var _ = require("lodash");
var EventEmitter = require("events").EventEmitter;
var sinon = require("sinon");

var TestRunner = require("../src/test_runner");

var MockIO = function () {
  this.unpipe = function () {};
};
MockIO.prototype = new EventEmitter();

var MockChildProcess = function () {
  this.stdout = new MockIO();
  this.stdout.setMaxListeners(50);
  this.stderr = new MockIO();
  this.stderr.setMaxListeners(50);
  this.removeAllListeners = function () {};
};
MockChildProcess.prototype = new EventEmitter();

var _testStruct = function (moreOpts) {
  return _.merge({
    testLocator: "baz",
    stopClock: function () {},
    startClock: function () {},
    getRuntime: function () {return 20;},
    fail: function () {},
    browser: {
      browserId: "chrome"
    },
    locator: "bar",
    status: 3,
    canRun: function () {
      return true;
    }
  }, moreOpts);
};

var _tests = function () {
  return [
    {test: "foo", locator: "bar"},
    {test: "bar", locator: "bar"},
    {test: "baz", locator: "bar"}
  ];
};

var _options = function (moreOpts) {
  return _.merge({
    browsers: [{
      browserId: "chrome",
      resolution: 2000,
      orientation: "portrait"
    }],
    allocator: {
      get: function (cb) {
        cb(null, {index: 0, tunnelId: 50, token: "foo"});
      },
      release: function () {}
    },
    listeners: [
      {
        listenTo: function () {}
      },
      {
        listenTo: function () {},
        flush: function () {}
      },
      {
        listenTo: function () {},
        flush: function () {
          return {
            then: function () {
              return {
                catch: function (cb) { cb({}); }
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

var _testOptions = function (moreOpts) {
  return _.merge({
    console: {
      log: function () {},
      error: function () {}
    },
    fs: {
      readFileSync: function () {
        return JSON.stringify({failures: {
          foo: 1,
          baz: 2
        }});
      },
      writeFileSync: function () {}
    },
    mkdirSync: function () {},
    fork: function () {
      var m = new MockChildProcess();
      m.setMaxListeners(50);
      return m;
    },
    sauceBrowsers: {
      browser: function () {
        return {foo: 1};
      }
    },
    settings: {
      testFramework: {
        TestRun: function () {
          this.getEnvironment = function () {
            return "foo";
          };
          this.getCommand = function () {
            return "command";
          };
          this.getArguments = function () {
            return "args";
          };
        }
      },
      tempDir: "foo",
      buildId: "buildId-bar"
    },
    clearInterval: function () {},
    setTimeout: function (cb) { cb(); },
    setInterval: function (cb) { cb(); },
    prettyMs: function () {return "";}
  }, moreOpts);
};

describe("TestRunner Class", function () {
  it("should initialize", function () {
    var tr = new TestRunner(_tests(), _options({}), _testOptions({}));
    expect(tr).to.be.not.be.null;
  });

  it("should initialize with bail options", function () {
    var tr1 = new TestRunner(_tests(), _options({bailFast: true}), _testOptions({}));
    expect(tr1).to.be.not.be.null;
    expect(tr1.strictness).to.eql(4);

    var tr2 = new TestRunner(_tests(), _options({bailOnThreshold: 3}), _testOptions({}));
    expect(tr2).to.be.not.be.null;
    expect(tr2.strictness).to.eql(3);

    var tr3 = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        bailTimeExplicitlySet: 1000
      }
    }));
    expect(tr3).to.be.not.be.null;
    expect(tr3.strictness).to.eql(2);
  });

  it("should initialize with trends", function () {
    var tr = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        gatherTrends: true
      }
    }));
    expect(tr).to.be.not.be.null;
    expect(tr.trends).to.eql({failures: {}});
  });

  it("should start", function () {
    var tr1 = new TestRunner(_tests(), _options(), _testOptions({}));
    tr1.start();
    expect(tr1.startTime).to.not.be.null;

    // Test serial
    var tr2 = new TestRunner(_tests(), _options({
      serial: true
    }), _testOptions({}));
    tr2.start();
    expect(tr2.startTime).to.not.be.null;

    // Test no tests
    var tr3 = new TestRunner([], _options({}), _testOptions({}));
    tr3.start();
    expect(tr3.startTime).to.not.be.null;
  });

  it("should idle", function () {
    var tr1 = new TestRunner(_tests(), _options(), _testOptions({}));
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

  it("should run a test", function () {
    var spy1 = sinon.spy();
    var tr1 = new TestRunner(_tests(), _options(), _testOptions({
      analytics: {
        push: spy1,
        mark: spy1
      }
    }));
    tr1.stageTest(_testStruct(), function () {});
    expect(spy1.called).to.be.true;
  });

  it("should fail on a bad worker allocation", function (done) {
    // Uncle Owen! This one"s got a bad motivator!
    var spy = sinon.spy();
    var test = {
      fail: spy
    };
    var tr = new TestRunner(_tests(), _options({
      allocator: {
        get: function (cb) {
          cb({bad: "stuff"});
        }
      }
    }), _testOptions({}));
    tr.stageTest(_testStruct(test), function () {
      expect(spy.called).to.be.true;
      done();
    });
  });

  it("should run through a passing test", function (done) {
    var myMock = new MockChildProcess();
    myMock.setMaxListeners(50);
    var spy = sinon.spy();
    var tr = new TestRunner(_tests(), _options({
      listeners: [
        {}
      ],
      debug: true
    }), _testOptions({
      fork: function () {
        return myMock;
      },
      settings: {
        gatherTrends: true
      }
    }));
    tr.stageTest(_testStruct({
      pass: spy
    }), function () {
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

  it("should run through a passing test w/o debugging", function (done) {
    var myMock = new MockChildProcess();
    myMock.setMaxListeners(50);
    var spy = sinon.spy();
    var tr = new TestRunner(_tests(), _options({
      listeners: [
        {}
      ]
    }), _testOptions({
      fork: function () {
        return myMock;
      },
      settings: {
        gatherTrends: true
      }
    }));
    tr.stageTest(_testStruct({
      pass: spy
    }), function () {
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

  it("should report failed tests", function () {
    var spy = sinon.spy();
    var text = "";
    var tr = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        gatherTrends: true
      },
      console: {
        log: function (t) {
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

  it("should handle failed tests", function (done) {
    var myMock = new MockChildProcess();
    myMock.setMaxListeners(50);
    var spy = sinon.spy();
    var tr = new TestRunner(_tests(), _options(), _testOptions({
      fork: function () {
        return myMock;
      },
      settings: {
        gatherTrends: true
      }
    }));
    tr.stageTest(_testStruct({
      fail: spy
    }), function () {
      expect(spy.called).to.be.true;
      tr.gatherTrends();
      tr.logFailedTests();
      tr.summarizeCompletedBuild();
      done();
    });
    myMock.emit("close", -1);
  });

  it("should handle inability to get test environment", function (done) {
    var spy = sinon.spy();
    var tr = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        testFramework: {
          TestRun: function () {
            return {
              getEnvironment: function () {
                throw new Error("Nope!");
              }
            };
          }
        }
      }
    }));
    tr.stageTest(_testStruct({
      fail: spy
    }), function () {
      expect(spy.called).to.be.true;
      done();
    });
  });

  it("should handle inability to fork", function (done) {
    var spy = sinon.spy();
    var tr = new TestRunner(_tests(), _options(), _testOptions({
      fork: function () {
        throw new Error("Nope!");
      }
    }));
    tr.stageTest(_testStruct({
      fail: spy
    }), function () {
      expect(spy.called).to.be.true;
      done();
    });
  });

  it("should handle throwing in listenTo", function () {
    var spy = sinon.spy();
    var tr = new TestRunner(_tests(), _options({
      listeners: [
        {
          listenTo: function () {
            throw "Whoops!";
          }
        }
      ]
    }), _testOptions());
    tr.stageTest(_testStruct({
      fail: spy
    }), function () {
      expect(spy.called).to.be.true;
      // Not sure this is actually correct behavior. A throw in a listener is not a test failure.
      done();
    });
  });

  it("should handle bailing", function () {
    var myMock = new MockChildProcess();
    myMock.setMaxListeners(50);
    var tr = new TestRunner(_tests(), _options({
      bailOnThreshold: 1
    }), _testOptions({
      fork: function () {
        return myMock;
      },
      settings: {
        gatherTrends: true
      }
    }));
    tr.stageTest(_testStruct(), function () {});
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

  it("should have bail fast logic", function () {
    var tr = new TestRunner(_tests(), _options({
      bailFast: true
    }), _testOptions({}));

    expect(tr.shouldBail()).to.be.false;
    tr.passedTests = [{attempts: 2}, {attempts: 1}];
    expect(tr.shouldBail()).to.be.false;
    tr.failedTests = [{attempts: 2}, {attempts: 1}];
    expect(tr.shouldBail()).to.be.true;
  });

  it("should have bail fast logic", function () {
    var tr = new TestRunner(_tests(), _options({
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

  it("should have bail early logic", function () {
    var tr = new TestRunner(_tests(), _options({
      bailOnThreshold: 1
    }), _testOptions({}));

    expect(tr.shouldBail()).to.be.false;
    tr.passedTests = [{attempts: 2}, {attempts: 1}];
    expect(tr.shouldBail()).to.be.false;
    tr.failedTests = [{attempts: 25}, {attempts: 26}];
    expect(tr.shouldBail()).to.be.true;
  });

  it("should summarize under various circumnstances", function () {
    var text = "";
    var tr = new TestRunner(_tests(), _options(), _testOptions({
      console: {
        log: function (t) {
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
      {status: 3, getRetries: function () { return 0; }},
      {status: 3, getRetries: function () { return 1; }},
      {status: 3, getRetries: function () { return 1; }}
    ];
    tr.summarizeCompletedBuild();
    expect(text.match(/Skipped: 3/).length).to.eql(1);
  });

  it("should handle various forms of test completion", function () {
    var text = "";
    var tr1 = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        gatherTrends: true
      },
      console: {
        log: function (t) {
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

    var tr2 = new TestRunner(_tests(), _options(), _testOptions());
    tr2.onTestComplete(new Error("foo"), _testStruct({
      status: 0
    }));
    expect(tr2.failedTests.length).to.eql(1);

    tr2.onTestComplete(new Error("foo"), _testStruct({
      status: 0,
      canRun: function () { return false; }
    }));
    expect(tr2.failedTests.length).to.eql(2);
  });
});
