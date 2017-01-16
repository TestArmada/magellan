/* eslint no-undef: 0, no-unused-expressions: 0, no-magic-numbers: 0 */
"use strict";
const expect = require("chai").expect;
const Reporter = require("../../../src/reporters/screenshot_aggregator/reporter");

describe("ScreenshotAggregator Reporter", () => {
  it("should initialize incorrectly", (done) => {
    const r = new Reporter({
      console: {log: () => {}},
      settings: {
      }
    });
    r.initialize().catch(() => {
      done();
    });
  });

  it("should initialize correctly", (done) => {
    const r = new Reporter({
      console: {log: () => {}},
      request: {
        post: (url, cb) => {
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
    r.initialize().then(() => {
      r.listenTo("foo", "bar", {
        addListener: () => {}
      });
      done();
    });
  });

  it("should handle random messages", (done) => {
    const r = new Reporter({
      console: {log: () => {}},
      request: {
        post: (url, cb) => {
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
    r.initialize().then(() => {
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

  it("should handle run end messages", (done) => {
    const r = new Reporter({
      console: {log: () => {}},
      request: {
        post: (url, cb) => {
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
        sync: (pattern) => {
          return pattern.indexOf("png") > -1 ? ["a"] : [];
        }
      },
      path: {
        resolve: () => {
          return "b";
        }
      },
      fs: {
        unlinkSync: () => {},
        createReadStream: () => {}
      }
    });
    r.initialize().then(() => {
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
          slug: () => { return "foo"; }
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

  it("should handle run end messages with single shots", (done) => {
    const r = new Reporter({
      console: {log: () => {}},
      request: {
        post: (url, cb) => {
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
        sync: (pattern) => {
          return pattern.indexOf("png") > -1 ? ["a"] : [];
        }
      },
      path: {
        resolve: () => {
          return "b";
        }
      },
      fs: {
        unlinkSync: () => {},
        createReadStream: () => {}
      }
    });
    r.initialize().then(() => {
      r._handleMessage({
        tempAssetPath: "./foo",
        buildId: "asdfasdfadf"
      }, {
        attempts: 2,
        maxAttempts: 3,
        browser: {
          slug: () => { return "foo"; }
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

  it("should handle bad server response", (done) => {
    const r = new Reporter({
      console: {log: () => {}},
      request: {
        post: (url, cb) => {
          expect(url).to.not.be.null;
          cb(null, null, "foo");
        }
      },
      settings: {
        aggregatorURL: "http://foo/"
      },
      glob: {
        sync: () => {
          return ["a", "b/a", "c"];
        }
      },
      fs: {
        unlinkSync: () => {},
        createReadStream: () => {}
      }
    });
    r.initialize().then(() => {
      r._handleMessage({
        tempAssetPath: "./foo",
        buildId: "asdfasdfadf"
      }, {
        attempts: 2,
        maxAttempts: 3,
        browser: {
          slug: () => { return "foo"; }
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
