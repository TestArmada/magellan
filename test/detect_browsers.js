/* eslint no-undef: 0, no-magic-numbers: 0 */
"use strict";
var expect = require("chai").expect;
var detectBrowsers = require("../src/detect_browsers");

describe("detectBrowsers", function () {
  it("should detect from CLI", function () {
    detectBrowsers.detectFromCLI({profile: "http://foo/#profile,profile"}, true, true, {
      console: {log: function () {}},
      syncRequest: function () {
        return {
          getBody: function () {
            return JSON.stringify({
              profiles: "foo,bar,baz"
            });
          }
        };
      }
    });
  });

  it("should detect from CLI with https", function () {
    detectBrowsers.detectFromCLI({profile: "https://foo/#profile,profile"}, true, true, {
      console: {log: function () {}},
      syncRequest: function () {
        return {
          getBody: function () {
            return JSON.stringify({
              profiles: "foo,bar,baz"
            });
          }
        };
      }
    });
  });

  it("should detect from CLI with https but no profiles", function () {
    detectBrowsers.detectFromCLI({profile: "https://foo/#profile,profile"}, true, true, {
      console: {log: function () {}},
      syncRequest: function () {
        return {
          getBody: function () {
            return JSON.stringify({
              profiles: []
            });
          }
        };
      }
    });
  });

  it("should detect with profiles and profile", function () {
    detectBrowsers.detectFromCLI({profile: "a,b,c", profiles: {
      a: [1, 2, 3]
    }}, true, true, {
      console: {log: function () {}}
    });
  });

  it("should detect with profiles and profile", function () {
    detectBrowsers.detectFromCLI({profile: "a", profiles: {
      a: [1, 2, 3]
    }}, true, true, {
      console: {log: function () {}}
    });
  });

  it("should detect with a profile that doesnt match", function () {
    detectBrowsers.detectFromCLI({profile: "z", profiles: {
      a: [1, 2, 3]
    }}, true, true, {
      console: {log: function () {}}
    });
  });

  it("should detect with no profile", function () {
    detectBrowsers.detectFromCLI({}, true, true, {
      console: {log: function () {}}
    });
  });

  it("should detect with bad profile", function () {
    detectBrowsers.detectFromCLI({profile: "bar"}, true, true, {
      console: {log: function () {}}
    });
  });

  it("should detect with browser", function () {
    detectBrowsers.detectFromCLI({browser: "bar,baz"}, true, true, {
      console: {log: function () {}}
    });
  });

  it("should detect with browser singular", function () {
    detectBrowsers.detectFromCLI({browser: "bar"}, true, true, {
      console: {log: function () {}}
    });
  });

  it("should detect with browser info", function () {
    detectBrowsers.detectFromCLI({
      browser: "bar",
      resolution: "1024",
      orientation: "left"
    }, true, true, {
      console: {log: function () {}}
    });
  });

  it("should detect with browser info and some profiles", function () {
    detectBrowsers.detectFromCLI({
      browser: "bar",
      resolution: "1024",
      orientation: "left",
      profiles: {bar: [1], baz: [1]},
      profile: "bar"
    }, true, true, {
      console: {log: function () {}}
    });
  });

  it("should detect without sauce", function () {
    detectBrowsers.detectFromCLI({
      browser: "bar",
      resolution: "1024",
      orientation: "left",
      profiles: {bar: [1], baz: [1]},
      profile: "bar"
    }, false, true, {
      console: {log: function () {}}
    });
  });

  it("should detect without sauce and not node", function () {
    detectBrowsers.detectFromCLI({
      browser: "iphone_9_3_OS_X_10_11_iPhone_5",
      resolution: "1024",
      orientation: "left",
      profiles: {baz: [1]},
      profile: "iphone_9_3_OS_X_10_11_iPhone_5"
    }, false, false, {
      console: {log: function () {}}
    });
  });

  it("should detect with profiles but without sauce and not node", function () {
    detectBrowsers.detectFromCLI({
      profiles: {baz: [1]},
      profile: "iphone_9_3_OS_X_10_11_iPhone_5"
    }, false, false, {
      console: {log: function () {}}
    });
  });

  it("should create browsers", function () {
    expect(detectBrowsers.createBrowser("a", "b", "c").slug()).to.eql("a_b_c");
    expect(detectBrowsers.createBrowser("a", "b", "c").toString()).to.eql("a @b orientation: c");
    expect(detectBrowsers.createBrowser("a", null, "c").slug()).to.eql("a_c");
    expect(detectBrowsers.createBrowser("a", null, "c").toString()).to.eql("a orientation: c");
    expect(detectBrowsers.createBrowser("a", "b", null).slug()).to.eql("a_b");
    expect(detectBrowsers.createBrowser("a", "b", null).toString()).to.eql("a @b");
  });

  it("should detect from CLI without sauce", function () {
    detectBrowsers.detectFromCLI({profile: "http://foo/#profile,profile"}, false, false, {
      console: {log: function () {}},
      syncRequest: function () {
        return {
          getBody: function () {
            return JSON.stringify({
              profiles: "foo,bar,baz"
            });
          }
        };
      }
    });
  });
});
