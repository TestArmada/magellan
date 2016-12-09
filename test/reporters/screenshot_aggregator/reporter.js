var expect = require('chai').expect;
var Reporter = require('../../../src/reporters/screenshot_aggregator/reporter');

describe('ScreenshotAggregator Reporter', function() {
  it('should initialize incorrectly', function(done) {
    var r = new Reporter({
      console: {log: function() {}},
      settings: {
      }
    });
    r.initialize().catch(function() {
      done();
    });
  });

  it('should initialize correctly', function(done) {
    var r = new Reporter({
      console: {log: function() {}},
      request: {
        post: function(url, cb) {
          expect(url).to.not.be.null;
          cb(null, null, JSON.stringify({
            status: "success",
            buildURL: "http://foo/bar.png"
          }));
        }
      },
      settings: {
        aggregatorURL: "http://foo/"
      }
    });
    r.initialize().then(function() {
      r.listenTo("foo", "bar", {
        addListener: function() {}
      });
      done();
    });
  });

  it('should handle random messages', function(done) {
    var r = new Reporter({
      console: {log: function() {}},
      request: {
        post: function(url, cb) {
          expect(url).to.not.be.null;
          cb(null, null, JSON.stringify({
            status: "success",
            buildURL: "http://foo/bar.png"
          }));
        }
      },
      settings: {
        aggregatorURL: "http://foo/"
      }
    });
    r.initialize().then(function() {
      r._handleMessage("foo", "bar", {
      });
      r._handleMessage("foo", "bar", {
        type: "bar"
      });
      r._handleMessage("foo", "bar", {
        type: "worker-status",
        status: "bar"
      });
      done();
    });
  });

  it('should handle run end messages', function(done) {
    var r = new Reporter({
      console: {log: function() {}},
      request: {
        post: function(url, cb) {
          expect(url).to.not.be.null;
          cb(null, null, JSON.stringify({
            status: "success",
            buildURL: "http://foo/bar.png"
          }));
        }
      },
      settings: {
        aggregatorURL: "http://foo/"
      },
      glob: {
        sync: function(pattern) {
          return pattern.indexOf("png") > -1 ? ["a"] : [];
        }
      },
      path: {
        resolve: function() {
          return "b";
        }
      },
      fs: {
        unlinkSync: function() {},
        createReadStream: function () {}
      }
    });
    r.initialize().then(function() {
      r._handleMessage({
        tempAssetPath: "./foo"
      }, {
        attempts: 1,
        maxAttempts: 3
      }, {
        type: "worker-status",
        status: "finished",
        passed: false
      });
      r.flush();

      r._handleMessage({
        tempAssetPath: "./foo",
        buildId: "asdfasdfadf"
      }, {
        attempts: 2,
        maxAttempts: 3,
        browser: {
          slug: function() { return "foo"; }
        }
      }, {
        type: "worker-status",
        status: "finished",
        passed: true,
        name: "yaddayadda"
      });
      r.flush();

      done();
    });
  });


    it('should handle run end messages with single shots', function(done) {
      var r = new Reporter({
        console: {log: function() {}},
        request: {
          post: function(url, cb) {
            expect(url).to.not.be.null;
            cb(null, null, JSON.stringify({
              status: "success",
              buildURL: "http://foo/bar.png"
            }));
          }
        },
        settings: {
          aggregatorURL: "http://foo/"
        },
        glob: {
          sync: function(pattern) {
            return pattern.indexOf("png") > -1 ? ["a"] : [];
          }
        },
        path: {
          resolve: function() {
            return "b";
          }
        },
        fs: {
          unlinkSync: function() {},
          createReadStream: function () {}
        }
      });
      r.initialize().then(function() {
        r._handleMessage({
          tempAssetPath: "./foo",
          buildId: "asdfasdfadf"
        }, {
          attempts: 2,
          maxAttempts: 3,
          browser: {
            slug: function() { return "foo"; }
          }
        }, {
          type: "worker-status",
          status: "finished",
          passed: true,
          name: "yaddayadda"
        });
        r.flush();

        done();
      });
    });

  it('should handle bad server response', function(done) {
    var r = new Reporter({
      console: {log: function() {}},
      request: {
        post: function(url, cb) {
          expect(url).to.not.be.null;
          cb(null, null, "foo");
        }
      },
      settings: {
        aggregatorURL: "http://foo/"
      },
      glob: {
        sync: function() {
          return ["a", "b/a", "c"];
        }
      },
      fs: {
        unlinkSync: function() {},
        createReadStream: function () {}
      }
    });
    r.initialize().then(function() {
      r._handleMessage({
        tempAssetPath: "./foo",
        buildId: "asdfasdfadf"
      }, {
        attempts: 2,
        maxAttempts: 3,
        browser: {
          slug: function() { return "foo"; }
        }
      }, {
        type: "worker-status",
        status: "finished",
        passed: true,
        name: "yaddayadda"
      });
      r.flush();

      done();
    });
  });
});
