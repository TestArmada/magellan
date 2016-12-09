var expect = require('chai').expect;
var Reporter = require('../../../src/reporters/slack/slack');

describe('Slack Reporter', function() {
  it('should initialize correctly', function(done) {
    var r = new Reporter({
      account: "a",
      key: "a",
      channel: "a",
      username: "a",
      iconURL: "a",
      jobName: "a",
      buildDisplayName: "a",
      buildURL: "a"
    }, {
      console: {
        log: function() {},
        error: function() {}
      },
      Slack: function() {
        this.notify = function() {}
      }
    });
    r.initialize().then(function() {
      r.flush();
      r._addFailure("a", "b", "c");
      r._addFailure("a");
      r.listenTo("a", "b", {
        addListener: function () {}
      });
      r.flush();
      done();
    });
  });

  it('should have issues with lack of config', function(done) {
    var r = new Reporter({
      account: "a",
      key: "a",
      username: "a",
      iconURL: "a",
      jobName: "a",
      buildDisplayName: "a",
      buildURL: "a"
    }, {
      console: {
        log: function() {},
        error: function() {}
      },
      Slack: function() {}
    });
    r.initialize().catch(function() {
      done();
    });
  });

  it('should handle messages', function(done) {
    var r = new Reporter({
      account: "a",
      key: "a",
      channel: "a",
      username: "a",
      iconURL: "a",
      jobName: "a",
      buildDisplayName: "a",
      buildURL: "a"
    }, {
      console: {
        log: function() {},
        error: function() {}
      },
      Slack: function() {
        this.notify = function() {}
      }
    });
    r.initialize().then(function() {
      r._handleMessage("a", "b", {
        type: "worker-status",
        status: "finished",
        name: "a",
        passed: false
      });
      r._handleMessage("a", "b", {
        type: "worker-status",
        status: "finished",
        name: "a",
        passed: false,
        metadata: {
          sauceURL: "foo",
          buildURL: "baz"
        }
      });
      r._handleMessage("a", "b", {
        type: "worker-status",
        status: "finished",
        name: "a",
        passed: false,
        metadata: {
          buildURL: "baz"
        }
      });
      r._handleMessage("a", "b", {
        type: "worker-status",
        status: "finished",
        name: "a",
        passed: true,
        metadata: {
        }
      });
      r._handleMessage("a", "b", {
        type: "foo"
      });
      r._handleMessage("a", "b", {
        type: "worker-status",
        status: "bar"
      });
      done();
    });
  });
});
