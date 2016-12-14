/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
var expect = require("chai").expect;
var _ = require("lodash");
var Q = require("Q");
var sinon = require("sinon");
var cli = require("../src/cli");

var _fakeReporter = function () {
  return {
    listenTo: function () {},
    flush: function () {}
  };
};

var _fakeRequire = function(overrides) {
  return function (name) {
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
        help: function () {}
      };
    }
    if (name === "./reporters/slack/settings") {
      return {};
    }
    if (name === "./reporters/slack/slack" ||
        name === "./reporters/screenshot_aggregator/reporter" ||
        name === "./reporters/stdout/reporter") {
      return _fakeReporter();
    }
    if (name.match(/\/index/)) {
      return {
        initialize: function() {},
        getPluginOptions: function () {}
      };
    }
    return {
    };
  };
};

var _testConfig = function (overrides) {
  return _.merge({
    console: {
      log: function () {},
      error: function () {}
    },
    require: _fakeRequire(),
    process: {
      cwd: function () {
        return "./";
      },
      exit: function () {
      }
    },
    analytics: {
      mark: function () {},
      push: function () {}
    },
    getTests: function() {
      return [
        {test: "a"},
        {test: "b"},
        {test: "c"}
      ]
    },
    margs: {
      init: function () {},
      argv: {
      }
    },
    settings: {
      framework: "foo"
    },
    processCleanup: function (cb) {
      cb();
    },
    path: {
      join: function(a, b) {
        var arr = [a, b];
        return arr.join("/");
      },
      resolve: function (str) {
        return str;
      }
    },
    SauceWorkerAllocator: function () {
      return {
        initialize: function (cb) {
          cb(null);
        },
        teardown: function (cb) {
          cb();
        }
      };
    },
    WorkerAllocator: function () {
      return {
        initialize: function (cb) {
          cb(null);
        },
        teardown: function (cb) {
          cb();
        }
      };
    },
    TestRunner: function (tests, opts) {
      this.opts = opts;
      this.start = function () {
        this.opts.onSuccess();
      }
    },
    browsers: {
      initialize: function () {
        var defer = Q.defer();
        defer.resolve();
        return defer.promise;
      }
    },
    testFilters: {
      detectFromCLI: function () {}
    },
    browserOptions: {
      detectFromCLI: function () {
        return [
          {browserId: "chrome", resolution: 1024, orientation: "portrait"},
          {browserId: "foo"}
        ];
      }
    }
  }, overrides);
};

describe("CLI", function () {
  it("startup", function (done) {
    var spy = sinon.spy();
    cli(_testConfig({
      console: {
        log: spy
      }
    })).then(function () {
      expect(spy.called).to.be.true;
      done();
    });
  });

  it("allow for config path", function (done) {
    var text = "";
    cli(_testConfig({
      yargs: {
        argv: {
          config: "FOOBAR_CONFIG"
        }
      },
      console: {
        log: function (t) {
          text += t;
        }
      }
    })).then(function () {
      expect(text.match(/FOOBAR_CONFIG/).length).to.eql(1);
      done();
    });
  });

  it("check for mocha", function (done) {
    cli(_testConfig({
      margs: {
        argv: {
          framework: "mocha"
        }
      },
      browserOptions: {
        detectFromCLI: function (a, b, c) {
          expect(c).to.be.true;
          return [
            {browserId: "chrome", resolution: 1024, orientation: "portrait"}
          ];
        }
      }
    })).then(function () {
      done();
    });
  });

  it("check for rowdy-mocha", function (done) {
    var sawRequire = false;
    cli(_testConfig({
      settings: {
        framework: "rowdy-mocha"
      },
      require: _fakeRequire(function (name) {
        if (name === "./node_modules/testarmada-magellan-mocha-plugin/index") {
          sawRequire = true;
        }
      })
    })).then(function () {
      expect(sawRequire).to.be.true;
      done();
    });

    try {
      cli(_testConfig({
        settings: {
          framework: "rowdy-mocha"
        },
        require: _fakeRequire(function (name) {
          if (name === "./node_modules/testarmada-magellan-mocha-plugin/index") {
            throw "Boom!";
          }
        })
      })).then(function () {
        expect(sawRequire).to.be.true;
        done();
      });
    } catch (e) {
    }
  });

  it("allow for sauce", function (done) {
    var spy = sinon.spy();
    cli(_testConfig({
      margs: {
        argv: {
          sauce: true
        }
      },
      browsers: {
        initialize: function(sauce) {
          expect(sauce).to.be.true;
          var defer = Q.defer();
          defer.resolve();
          return defer.promise;
        }
      }
    })).then(function () {
      done();
    });
  });

  it("show help", function (done) {
    var spy = sinon.spy();
    cli(_testConfig({
      margs: {
        argv: {
          help: true
        }
      },
      require: _fakeRequire(function (name) {
        if (name === "./cli_help") {
          return {
            help: spy
          };
        }
        return null;
      })
    })).then(function () {
      expect(spy.called).to.be.true;
      done();
    });
  });

  it("allow for no plugin options", function (done) {
    cli(_testConfig({
      require: _fakeRequire(function (name) {
        if (name.match(/\/index/)) {
          return {
            initialize: function() {}
          };
        }
      })
    })).then(function () {
      done();
    });
  });

  it("throw an exception in initialization", function (done) {
    cli(_testConfig({
      require: _fakeRequire(function (name) {
        if (name.match(/\/index/)) {
          return {
            initialize: function() {
              throw "Hey!";
            }
          };
        }
      })
    })).then(function () {
    }).catch(function() {
      done();
    });
  });

  it("allow for setup_teardown", function (done) {
    var called = false;
    cli(_testConfig({
      margs: {
        argv: {
          setup_teardown: "hola!"
        }
      },
      loadRelativeModule: function () {
        return {
          initialize: function () {
            called = true;
            var defer = Q.defer();
            defer.resolve();
            return defer.promise;
          }
        };
      }
    })).then(function () {
      expect(called).to.be.true;
      done();
    }).catch(function (e) {
    });
  });

  it("allow for reporters", function (done) {
    var called = false;
    cli(_testConfig({
      margs: {
        argv: {
          reporters: ["a", "b", "c"]
        }
      },
      loadRelativeModule: function () {
        return {
          initialize: function () {
            called = true;
            var defer = Q.defer();
            defer.resolve();
            return defer.promise;
          }
        };
      }
    })).then(function () {
      expect(called).to.be.true;
      done();
    }).catch(function (e) {
    });
  });

  it("allow for aggregateScreenshots", function (done) {
    var called = false;
    cli(_testConfig({
      settings: {
        aggregateScreenshots: true
      },
      require: _fakeRequire(function (name) {
        if (name === "./reporters/screenshot_aggregator/reporter") {
          return function () {
            this.initialize = function () {
              called = true;
              var defer = Q.defer();
              defer.reject({});
              return defer.promise;
            };
          }
        }
      })
    })).then(function () {
    }).catch(function (e) {
      expect(called).to.be.true;
      done();
    });
  });

  it("allow for serial", function (done) {
    var called = false;
    cli(_testConfig({
      margs: {
        argv: {
          serial: true
        }
      },
      require: _fakeRequire(function (name) {
        if (name === "./reporters/stdout/reporter") {
          return function () {
            this.initialize = function () {
              called = true;
              var defer = Q.defer();
              defer.resolve();
              return defer.promise;
            };
          }
        }
      })
    })).then(function () {
      expect(called).to.be.true;
      done();
    }).catch(function (e) {
    });
  });

  it("allow for serial and sauce", function (done) {
    var called = false;
    cli(_testConfig({
      margs: {
        argv: {
          serial: true,
          sauce: true
        }
      },
      require: _fakeRequire(function (name) {
        if (name === "./reporters/stdout/reporter") {
          return function () {
            this.initialize = function () {
              called = true;
              var defer = Q.defer();
              defer.resolve();
              return defer.promise;
            };
          }
        }
      })
    })).then(function () {
      expect(called).to.be.true;
      done();
    }).catch(function (e) {
    });
  });

  it("allow for optional_reporters", function (done) {
    var called = false;
    cli(_testConfig({
      margs: {
        argv: {
          optional_reporters: ["a", "b", "c"]
        }
      },
      loadRelativeModule: function () {
        return {
          initialize: function () {
            called = true;
            var defer = Q.defer();
            defer.resolve();
            return defer.promise;
          }
        };
      }
    })).then(function () {
      expect(called).to.be.true;
      done();
    }).catch(function (e) {
    });
  });

  it("allow for no browsers", function (done) {
    var called = false;
    cli(_testConfig({
      browserOptions: {
        detectFromCLI: function () {
          called = true;
          return null;
        }
      }
    })).then(function () {
    }).catch(function (e) {
      expect(called).to.be.true;
      done();
    });
  });

  it("allow for zero browsers", function (done) {
    var called = false;
    cli(_testConfig({
      browserOptions: {
        detectFromCLI: function () {
          called = true;
          return [];
        }
      }
    })).then(function () {
    }).catch(function (e) {
      expect(called).to.be.true;
      done();
    });
  });

  it("allow for just phantomjs", function (done) {
    var called = false;
    cli(_testConfig({
      browserOptions: {
        detectFromCLI: function () {
          called = true;
          return ["phantomjs"];
        }
      }
    })).then(function () {
      expect(called).to.be.true;
      done();
    }).catch(function (e) {
    });
  });

  it("allow for debug", function (done) {
    cli(_testConfig({
      margs: {
        argv: {
          debug: true
        }
      },
      TestRunner: function (tests, opts) {
        expect(opts.debug).to.be.true;
        this.opts = opts;
        this.start = function () {
          this.opts.onSuccess();
        }
      }
    })).then(function () {
      done();
    }).catch(function (e) {
    });
  });

  it("allow for no tests", function (done) {
    var called = false;
    cli(_testConfig({
      getTests: function () {
        called = true;
        return [];
      }
    })).then(function () {
    }).catch(function (e) {
      expect(called).to.be.true;
      done();
    });
  });

  it("allow for failing worker", function (done) {
    var called = false;
    cli(_testConfig({
      TestRunner: function (tests, opts) {
        called = true;
        this.opts = opts;
        this.start = function () {
          this.opts.onFailure();
        }
      }
    })).then(function () {
    }).catch(function (e) {
      expect(called).to.be.true;
      done();
    });
  });

  it("allow for bad WorkerAllocator", function (done) {
    var called = false;
    cli(_testConfig({
      WorkerAllocator: function () {
        return {
          initialize: function (cb) {
            called = true;
            cb({});
          },
          teardown: function (cb) {
            cb();
          }
        };
      },
    })).then(function () {
    }).catch(function (e) {
      expect(called).to.be.true;
      done();
    });
  });

  it("allow for bail_early", function (done) {
    cli(_testConfig({
      margs: {
        argv: {
          bail_early: true
        }
      },
      TestRunner: function (tests, opts) {
        expect(opts.bailOnThreshold).to.be.true;
        this.opts = opts;
        this.start = function () {
          this.opts.onSuccess();
        }
      }
    })).then(function () {
      done();
    }).catch(function (e) {
    });
  });

  it("allow for bail_fast", function (done) {
    cli(_testConfig({
      margs: {
        argv: {
          bail_fast: true
        }
      },
      TestRunner: function (tests, opts) {
        expect(opts.bailFast).to.be.true;
        this.opts = opts;
        this.start = function () {
          this.opts.onSuccess();
        }
      },
    })).then(function () {
      done();
    }).catch(function (e) {
    });
  });

  it("allow for slack initialization", function (done) {
    var called = false;
    cli(_testConfig({
      require: _fakeRequire(function (name) {
        if (name === "./reporters/slack/settings") {
          return {
            enabled: true
          };
        }
        if (name === "./reporters/slack/slack") {
          return function () {
            return {
              initialize: function () {
                called = true;
                var defer = Q.defer();
                defer.resolve();
                return defer.promise;
              }
            };
          }
        }
      })
    })).then(function () {
      expect(called).to.be.true;
      done();
    }).catch(function (e) {
    });
  });

  it("list browsers", function (done) {
    var spy = sinon.spy();
    cli(_testConfig({
      margs: {
        argv: {
          list_browsers: true
        }
      },
      browsers: {
        initialize: function (a) {
          expect(a).to.be.true;
          var defer = Q.defer();
          defer.resolve();
          return defer.promise;
        },
        listBrowsers: spy
      }
    })).then(function () {
      expect(spy.called).to.be.true;
      done();
    });
  });

  it("fail in list browsers", function (done) {
    cli(_testConfig({
      margs: {
        argv: {
          list_browsers: true
        }
      },
      browsers: {
        listBrowsers: function () {
          throw "Foo!";
        }
      }
    }))
    .then(function () {
    })
    .catch(function () {
      done();
    });
  });

  it("list browsers with device_additions", function (done) {
    var spy = sinon.spy();
    cli(_testConfig({
      margs: {
        argv: {
          list_browsers: true,
          device_additions: "hey"
        }
      },
      browsers: {
        initialize: function (a) {
          expect(a).to.be.true;
          var defer = Q.defer();
          defer.resolve();
          return defer.promise;
        },
        listBrowsers: spy,
        addDevicesFromFile: function (f) {
          expect(f).to.eql("hey");
        }
      }
    }))
    .then(function () {
      expect(spy.called).to.be.true;
      done();
    })
    .catch(function(err) {
    });
  });

  it("deal with device_additions", function (done) {
    var called = false;
    cli(_testConfig({
      margs: {
        argv: {
          device_additions: "hey"
        }
      },
      browsers: {
        addDevicesFromFile: function (f) {
          called = true;
          expect(f).to.eql("hey");
        }
      }
    })).then(function () {
      expect(called).to.be.true;
      done();
    });
  });
});
