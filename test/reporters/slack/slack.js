/* eslint no-undef: 0 */
"use strict";
const Reporter = require("../../../src/reporters/slack/slack");

class TestSlack {
  constructor() {
  }
  notify() {
  }
}

describe("Slack Reporter", () => {
  it("should initialize correctly", (done) => {
    const r = new Reporter({
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
        log: () => {},
        error: () => {}
      },
      Slack: TestSlack
    });
    r.initialize().then(() => {
      r.flush();
      r._addFailure("a", "b", "c");
      r._addFailure("a");
      r.listenTo("a", "b", {
        addListener: () => {}
      });
      r.flush();
      done();
    });
  });

  it("should have issues with lack of config", (done) => {
    const r = new Reporter({
      account: "a",
      key: "a",
      username: "a",
      iconURL: "a",
      jobName: "a",
      buildDisplayName: "a",
      buildURL: "a"
    }, {
      console: {
        log: () => {},
        error: () => {}
      },
      Slack: TestSlack
    });
    r.initialize().catch(() => {
      done();
    });
  });

  it("should handle messages", (done) => {
    const r = new Reporter({
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
        log: () => {},
        error: () => {}
      },
      Slack: TestSlack
    });
    r.initialize().then(() => {
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
