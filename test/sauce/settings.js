/* eslint no-undef: 0, no-magic-numbers: 0, camelcase: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const settingsFunc = require("../../src/sauce/settings");

describe("sauce/settings", () => {
  it("should handle no args or env", () => {
    const st = settingsFunc({console: {log: () => {}}});
    expect(st.locksPollingInterval).to.eql(2500);
  });

  it("should handle locksServerLocation", () => {
    const st = settingsFunc({
      console: {log: () => {}},
      argv: {
        locks_server: "foo/",
        debug: true
      }
    });
    expect(st.locksPollingInterval).to.eql(2500);
  });

  it("should handle invalid locksServerLocation", () => {
    const st = settingsFunc({
      console: {log: () => {}},
      argv: {
        locks_server: "foo"
      }
    });
    expect(st.locksPollingInterval).to.eql(2500);
  });

  it("should handle SAUCE_USERNAME", () => {
    const st = settingsFunc({
      console: {log: () => {}},
      env: {
        SAUCE_USERNAME: "foo"
      }
    });
    expect(st.locksPollingInterval).to.eql(2500);
  });

  it("should sauce argv", () => {
    const st = settingsFunc({
      console: {log: () => {}},
      argv: {
        sauce: true
      },
      env: {
        SAUCE_USERNAME: "jack",
        SAUCE_ACCESS_KEY: "hoobie",
        SAUCE_CONNECT_VERSION: "doobie"
      }
    });
    expect(st.username).to.eql("jack");
  });

  it("should sauce argv without optional version", () => {
    const st = settingsFunc({
      console: {log: () => {}},
      argv: {
        sauce: true
      },
      env: {
        SAUCE_USERNAME: "jack",
        SAUCE_ACCESS_KEY: "hoobie"
      }
    });
    expect(st.username).to.eql("jack");
  });

  it("should sauce throw argv without user", () => {
    let ex = null;
    try {
      settingsFunc({
        console: {log: () => {}},
        argv: {
          sauce: true
        },
        env: {
          SAUCE_ACCESS_KEY: "hoobie",
          SAUCE_CONNECT_VERSION: "doobie"
        }
      });
    } catch (e) {
      ex = e;
    }
    expect(ex).to.not.be.null;
  });

  it("should throw on bad tunnel config", () => {
    let ex = null;
    try {
      settingsFunc({
        console: {log: () => {}},
        argv: {
          sauce: true,
          sauce_tunnel_id: "foo",
          create_tunnels: true
        },
        env: {
          SAUCE_USERNAME: "jack",
          SAUCE_ACCESS_KEY: "hoobie",
          SAUCE_CONNECT_VERSION: "doobie"
        }
      });
    } catch (e) {
      ex = e;
    }
    expect(ex).to.not.be.null;
  });

  it("should throw on bad tunnel parent config", () => {
    let ex = null;
    try {
      settingsFunc({
        console: {log: () => {}},
        argv: {
          sauce: true,
          shared_sauce_parent_account: "foo",
          create_tunnels: true
        },
        env: {
          SAUCE_USERNAME: "jack",
          SAUCE_ACCESS_KEY: "hoobie",
          SAUCE_CONNECT_VERSION: "doobie"
        }
      });
    } catch (e) {
      ex = e;
    }
    expect(ex).to.not.be.null;
  });
});
