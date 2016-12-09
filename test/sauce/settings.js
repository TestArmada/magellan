var expect = require('chai').expect;
var settingsFunc = require('../../src/sauce/settings');

describe('sauce/settings', function() {
  it('should handle no args or env', function() {
    var st = settingsFunc({console: {log: function() {}}});
    expect(st.locksPollingInterval).to.eql(2500);
  });

  it('should handle locksServerLocation', function() {
    var st = settingsFunc({
      console: {log: function() {}},
      argv: {
        locks_server: "foo/",
        debug: true
      }
    });
    expect(st.locksPollingInterval).to.eql(2500);
  });

  it('should handle invalid locksServerLocation', function() {
    var st = settingsFunc({
      console: {log: function() {}},
      argv: {
        locks_server: "foo"
      }
    });
    expect(st.locksPollingInterval).to.eql(2500);
  });

  it('should handle SAUCE_USERNAME', function() {
    var st = settingsFunc({
      console: {log: function() {}},
      env: {
        SAUCE_USERNAME: "foo"
      }
    });
    expect(st.locksPollingInterval).to.eql(2500);
  });

  it('should sauce argv', function() {
    var st = settingsFunc({
      console: {log: function() {}},
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

  it('should sauce argv without optional version', function() {
    var st = settingsFunc({
      console: {log: function() {}},
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

  it('should sauce throw argv without user', function() {
    var ex = null;
    try {
      var st = settingsFunc({
        console: {log: function() {}},
        argv: {
          sauce: true
        },
        env: {
          SAUCE_ACCESS_KEY: "hoobie",
          SAUCE_CONNECT_VERSION: "doobie"
        }
      });
    } catch(e) {
      ex = e;
    }
    expect(ex).to.not.be.null;
  });

  it('should throw on bad tunnel config', function() {
    var ex = null;
    try {
      var st = settingsFunc({
        console: {log: function() {}},
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
    } catch(e) {
      ex = e;
    }
    expect(ex).to.not.be.null;
  });

  it('should throw on bad tunnel parent config', function() {
    var ex = null;
    try {
      var st = settingsFunc({
        console: {log: function() {}},
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
    } catch(e) {
      ex = e;
    }
    expect(ex).to.not.be.null;
  });
});
