/* eslint no-undef: 0, no-magic-numbers: 0 */
"use strict";
const expect = require("chai").expect;
const detectBrowsers = require("../src/detect_browsers");

describe("detectBrowsers", () => {
  it("should detect from CLI", () => {
    detectBrowsers.detectFromCLI({profile: "http://foo/#profile,profile"}, true, true, {
      console: {log: () => {}},
      syncRequest: () => {
        return {
          getBody: () => {
            return JSON.stringify({
              profiles: "foo,bar,baz"
            });
          }
        };
      }
    });
  });

  it("should detect from CLI with https", () => {
    detectBrowsers.detectFromCLI({profile: "https://foo/#profile,profile"}, true, true, {
      console: {log: () => {}},
      syncRequest: () => {
        return {
          getBody: () => {
            return JSON.stringify({
              profiles: "foo,bar,baz"
            });
          }
        };
      }
    });
  });

  it("should detect from CLI with https but no profiles", () => {
    detectBrowsers.detectFromCLI({profile: "https://foo/#profile,profile"}, true, true, {
      console: {log: () => {}},
      syncRequest: () => {
        return {
          getBody: () => {
            return JSON.stringify({
              profiles: []
            });
          }
        };
      }
    });
  });

  it("should detect with profiles and profile", () => {
    detectBrowsers.detectFromCLI({profile: "a,b,c", profiles: {
      a: [1, 2, 3]
    }}, true, true, {
      console: {log: () => {}}
    });
  });

  it("should detect with profiles and profile", () => {
    detectBrowsers.detectFromCLI({profile: "a", profiles: {
      a: [1, 2, 3]
    }}, true, true, {
      console: {log: () => {}}
    });
  });

  it("should detect with a profile that doesnt match", () => {
    detectBrowsers.detectFromCLI({profile: "z", profiles: {
      a: [1, 2, 3]
    }}, true, true, {
      console: {log: () => {}}
    });
  });

  it("should detect with no profile", () => {
    detectBrowsers.detectFromCLI({}, true, true, {
      console: {log: () => {}}
    });
  });

  it("should detect with bad profile", () => {
    detectBrowsers.detectFromCLI({profile: "bar"}, true, true, {
      console: {log: () => {}}
    });
  });

  it("should detect with browser", () => {
    detectBrowsers.detectFromCLI({browser: "bar,baz"}, true, true, {
      console: {log: () => {}}
    });
  });

  it("should detect with browser singular", () => {
    detectBrowsers.detectFromCLI({browser: "bar"}, true, true, {
      console: {log: () => {}}
    });
  });

  it("should detect with browser info", () => {
    detectBrowsers.detectFromCLI({
      browser: "bar",
      resolution: "1024",
      orientation: "left"
    }, true, true, {
      console: {log: () => {}}
    });
  });

  it("should detect with browser info and some profiles", () => {
    detectBrowsers.detectFromCLI({
      browser: "bar",
      resolution: "1024",
      orientation: "left",
      profiles: {bar: [1], baz: [1]},
      profile: "bar"
    }, true, true, {
      console: {log: () => {}}
    });
  });

  it("should detect without sauce", () => {
    detectBrowsers.detectFromCLI({
      browser: "bar",
      resolution: "1024",
      orientation: "left",
      profiles: {bar: [1], baz: [1]},
      profile: "bar"
    }, false, true, {
      console: {log: () => {}}
    });
  });

  it("should detect without sauce and not node", () => {
    detectBrowsers.detectFromCLI({
      browser: "iphone_9_3_OS_X_10_11_iPhone_5",
      resolution: "1024",
      orientation: "left",
      profiles: {baz: [1]},
      profile: "iphone_9_3_OS_X_10_11_iPhone_5"
    }, false, false, {
      console: {log: () => {}}
    });
  });

  it("should detect with profiles but without sauce and not node", () => {
    detectBrowsers.detectFromCLI({
      profiles: {baz: [1]},
      profile: "iphone_9_3_OS_X_10_11_iPhone_5"
    }, false, false, {
      console: {log: () => {}}
    });
  });

  it("should create browsers", () => {
    expect(detectBrowsers.createBrowser("a", "b", "c").slug()).to.eql("a_b_c");
    expect(detectBrowsers.createBrowser("a", "b", "c").toString()).to.eql("a @b orientation: c");
    expect(detectBrowsers.createBrowser("a", null, "c").slug()).to.eql("a_c");
    expect(detectBrowsers.createBrowser("a", null, "c").toString()).to.eql("a orientation: c");
    expect(detectBrowsers.createBrowser("a", "b", null).slug()).to.eql("a_b");
    expect(detectBrowsers.createBrowser("a", "b", null).toString()).to.eql("a @b");
  });

  it("should detect from CLI without sauce", () => {
    detectBrowsers.detectFromCLI({profile: "http://foo/#profile,profile"}, false, false, {
      console: {log: () => {}},
      syncRequest: () => {
        return {
          getBody: () => {
            return JSON.stringify({
              profiles: "foo,bar,baz"
            });
          }
        };
      }
    });
  });
});
