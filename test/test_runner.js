var expect = require('chai').expect;
var TestRunner = require('../src/test_runner');
var _ = require('lodash');
var EventEmitter = require("events").EventEmitter;

var MockIO = function () {
  this.unpipe = function() {};
}
MockIO.prototype = new EventEmitter();

var MockChildProcess = function () {
  this.stdout = new MockIO();
  this.stdout.setMaxListeners(50);
  this.stderr = new MockIO();
  this.stderr.setMaxListeners(50);
  this.removeAllListeners = function () {};
}
MockChildProcess.prototype = new EventEmitter();

var _testStruct = function(moreOpts) {
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
    canRun: function() {
      return true;
    }
  }, moreOpts);
}

var _tests = function() {
  return [
    {test: "foo", locator: "bar"},
    {test: "bar", locator: "bar"},
    {test: "baz", locator: "bar"},
  ];
};

var _options = function(moreOpts) {
  return _.merge({
    browsers: [{
      browserId: "chrome",
      resolution: 2000,
      orientation: "portrait"
    }],
    allocator: {
      get: function(cb) {
        cb(null, {index: 0, tunnelId: 50, token: "foo"});
      },
      release: function() {},
    },
    listeners: [
      {
        listenTo: function() {},
      },
      {
        listenTo: function() {},
        flush: function() {}
      },
      {
        listenTo: function() {},
        flush: function() {
          return {
            then: function() {
              return {
                catch: function(cb) {cb({})}
              };
            },
          }
        }
      }
    ],
    sauceSettings: {
      user: "Jack"
    }
  }, moreOpts);
}

var _testOptions = function(moreOpts) {
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
      return new MockChildProcess();
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
    setTimeout: function (cb) {cb()},
    setInterval: function (cb) {cb()},
    prettyMs: function () {return "";}
  }, moreOpts);
};

describe('TestRunner Class', function() {
  it('should initialize', function() {
    var tr = new TestRunner(_tests(), _options({}), _testOptions({}));
    expect(tr).to.be.not.be.null;
  });

  it('should initialize with bail options', function() {
    var tr1 = new TestRunner(_tests(), _options({bailFast: true}), _testOptions({}));
    expect(tr1).to.be.not.be.null;

    var tr2 = new TestRunner(_tests(), _options({bailOnThreshold: 3}), _testOptions({}));
    expect(tr2).to.be.not.be.null;

    var tr3 = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        bailTimeExplicitlySet: 1000
      }
    }));
    expect(tr3).to.be.not.be.null;
  });

  it('should initialize with trends', function() {
    var tr = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        gatherTrends: true
      }
    }));
    expect(tr).to.be.not.be.null;
  });

  it('should start', function() {
    var tr1 = new TestRunner(_tests(), _options(), _testOptions({}));
    tr1.start();

    // Test serial
    var tr2 = new TestRunner(_tests(), _options({
      serial: true
    }), _testOptions({}));
    tr2.start();

    // Test no tests
    var tr3 = new TestRunner([], _options({}), _testOptions({}));
    tr3.start();
  });

  it('should idle', function() {
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

  it('should idle', function() {
    var tr1 = new TestRunner(_tests(), _options(), _testOptions({}));
    tr1.stageTest(_testStruct(), function() {});

    // Uncle Owen! This one's got a bad motivator!
    var tr2 = new TestRunner(_tests(), _options({
      allocator: {
        get: function(cb) {
          cb({bad: "stuff"});
        }
      }
    }), _testOptions({}));
    tr2.stageTest(_testStruct(), function() {});
  });

  it('should run through a passing test', function() {
    var myMock = new MockChildProcess();
    var tr1 = new TestRunner(_tests(), _options({
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
    tr1.stageTest(_testStruct(), function() {});

    myMock.emit("message", {sessionId: 52});
    myMock.emit("message", {type: "selenium-session-info", sessionId: 52});
    myMock.stdout.emit("data", "");
    myMock.stdout.emit("data", "Lotsa love");
    myMock.stdout.emit("data", "Lotsa love\n2");
    myMock.stderr.emit("data", "");
    myMock.stderr.emit("data", "Notso lotsa love");
    myMock.stderr.emit("data", "Notso lotsa love\n2");
    myMock.emit("close", 0);

    tr1.trends.failures = {
      fooz: 1,
      bar: 2,
      baz: 3
    };
    tr1.gatherTrends();
    tr1.logFailedTests();
    tr1.summarizeCompletedBuild();
  });

  it('should run through a passing test w/o debugging', function() {
    var myMock = new MockChildProcess();
    var tr1 = new TestRunner(_tests(), _options({
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
    tr1.stageTest(_testStruct(), function() {});

    myMock.emit("message", {sessionId: 52});
    myMock.emit("message", {type: "selenium-session-info", sessionId: 52});
    myMock.emit("close", 0);

    tr1.gatherTrends();
    tr1.logFailedTests();
    tr1.summarizeCompletedBuild();
  });

  it('should have failed tests', function() {
    var tr1 = new TestRunner(_tests(), _options(), _testOptions({}));
    tr1.failedTests = [
      {}
    ];
    tr1.gatherTrends();
    tr1.logFailedTests();
    tr1.summarizeCompletedBuild();
  });

  it('should handled failed tests', function() {
    var myMock = new MockChildProcess();
    var tr1 = new TestRunner(_tests(), _options(), _testOptions({
      fork: function () {
        return myMock;
      },
      settings: {
        gatherTrends: true
      }
    }));
    tr1.stageTest(_testStruct(), function() {});
    myMock.emit("close", -1);

    tr1.gatherTrends();
    tr1.logFailedTests();
    tr1.summarizeCompletedBuild();
  });

  it('should handle inability to get test environment', function() {
    var tr1 = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        testFramework: {
          TestRun: function () {
            return {
              getEnvironment: function () {
                throw new Error("Nope!");
              }
            }
          }
        }
      }
    }));
    tr1.stageTest(_testStruct(), function() {});
  });

  it('should handle inability to fork', function() {
    var tr2 = new TestRunner(_tests(), _options(), _testOptions({
      fork: function () {
        throw new Error("Nope!");
      }
    }));
    tr2.stageTest(_testStruct(), function() {});
  });

  it('should handle throwing in listenTo', function() {
    var tr2 = new TestRunner(_tests(), _options({
      listeners: [
        {
          listenTo: function() {
            throw new "Whoops!";
          }
        }
      ]
    }), _testOptions());
    tr2.stageTest(_testStruct(), function() {});
  });

  it('should handle bailing', function() {
    var myMock = new MockChildProcess();
    var tr1 = new TestRunner(_tests(), _options({
      bailOnThreshold: 1
    }), _testOptions({
      fork: function () {
        return myMock;
      },
      settings: {
        gatherTrends: true
      }
    }));
    tr1.stageTest(_testStruct(), function() {});
    myMock.emit("close", -1);
    myMock.emit("close", -1);
    myMock.emit("close", -1);

    tr1.shouldBail();
    tr1.passedTests = [{attempts: 2}, {attempts: 1}];
    tr1.shouldBail();
    tr1.failedTests = [{attempts: 2}, {attempts: 1}];
    tr1.shouldBail();

    tr1.gatherTrends();
    tr1.logFailedTests();
    tr1.summarizeCompletedBuild();
  });

  it('should have bail fast logic', function() {
    var myMock = new MockChildProcess();
    var tr1 = new TestRunner(_tests(), _options({
      bailFast: true
    }), _testOptions({}));

    tr1.shouldBail();
    tr1.passedTests = [{attempts: 2}, {attempts: 1}];
    tr1.shouldBail();
    tr1.failedTests = [{attempts: 2}, {attempts: 1}];
    tr1.shouldBail();
  });

  it('should have bail fast logic', function() {
    var myMock = new MockChildProcess();
    var tr1 = new TestRunner(_tests(), _options({
      bailFast: true
    }), _testOptions({}));

    tr1.shouldBail();
    tr1.passedTests = [{attempts: 2}, {attempts: 1}];
    tr1.shouldBail();
    tr1.failedTests = [{attempts: 2}, {attempts: 1}];
    tr1.shouldBail();

    tr1.hasBailed = false;
    tr1.checkBuild();
  });

  it('should have bail early logic', function() {
    var myMock = new MockChildProcess();
    var tr1 = new TestRunner(_tests(), _options({
      bailOnThreshold: 1
    }), _testOptions({}));

    tr1.shouldBail();
    tr1.passedTests = [{attempts: 2}, {attempts: 1}];
    tr1.shouldBail();
    tr1.failedTests = [{attempts: 2}, {attempts: 1}];
    tr1.shouldBail();
  });

  it('should summarize under various circumnstances', function() {
    var myMock = new MockChildProcess();
    var tr1 = new TestRunner(_tests(), _options(), _testOptions());

    tr1.summarizeCompletedBuild();

    tr1.hasBailed = true;
    tr1.summarizeCompletedBuild();

    tr1.tests = [
      {status: 0},
      {status: 3, getRetries: function() { return 0; }},
      {status: 3, getRetries: function() { return 1; }},
      {status: 3, getRetries: function() { return 1; }}
    ]
    tr1.summarizeCompletedBuild();
  });

  it('should handle various forms of test completion', function() {
    var tr1 = new TestRunner(_tests(), _options(), _testOptions({
      settings: {
        gatherTrends: true
      }
    }));

    tr1.hasBailed = true;
    tr1.onTestComplete(new Error("foo"), _testStruct());

    tr1.hasBailed = false;
    tr1.onTestComplete(new Error("foo"), _testStruct({
      status: 0
    }));

    tr1.hasBailed = false;
    tr1.onTestComplete(new Error("foo"), _testStruct({
      status: 3
    }));

    tr1.serial = true;
    tr1.onTestComplete(new Error("foo"), _testStruct({
      status: 3
    }));

    var tr2 = new TestRunner(_tests(), _options(), _testOptions());
    tr2.onTestComplete(new Error("foo"), _testStruct({
      status: 0
    }));
    tr2.onTestComplete(new Error("foo"), _testStruct({
      status: 0,
      canRun: function () { return false; }
    }));
  });
});
