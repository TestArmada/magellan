"use strict";

const _ = require("lodash");
const syncRequest = require("sync-request");
const profile = require("../src/profiles");

// jest.mock('sync-request', (method, url) => {
//   // return {
//   //   getBody(encoding) {
//   //     return "{\"profiles\":{\"chrome\":{\"browser\":\"chrome\"},\"firefox\":{\"browser\":\"firefox\"}}}";
//   //   }
//   // };
//   return "{\"profiles\":{\"chrome\":{\"browser\":\"chrome\"},\"firefox\":{\"browser\":\"firefox\"}}}"
// });

jest.mock("sync-request");

const opts = {
  settings: {
    testExecutors: {
      "sauce": {
        getProfiles: (opts) => Promise.resolve(opts.profiles),
        getCapabilities: (profile, opts) => Promise.resolve(profile)
      }
    }
  },
  argv: {}
};

let runOpts = {};


describe("Read from --profile", () => {
  beforeEach(() => {

    syncRequest.mockImplementation(() => {
      return {
        getBody(encoding) {
          return "{\"profiles\":{\"chrome\":{\"browser\":\"chrome\"},\"firefox\":{\"browser\":\"firefox\"}}}";
        }
      };
    });

    runOpts = _.cloneDeep(opts);
  });

  test("one profile from http", (done) => {
    runOpts.argv.profile = "http://some_fake_url#chrome";

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).toEqual(1);
        expect(resolvedprofiles[0].browser).toEqual("chrome");
        expect(resolvedprofiles[0].executor).toEqual("sauce");
        done();
      });
  });

  test("one profile from https", (done) => {
    runOpts.argv.profile = "https://some_fake_url#chrome";

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).toEqual(1);
        expect(resolvedprofiles[0].browser).toEqual("chrome");
        expect(resolvedprofiles[0].executor).toEqual("sauce");
        done();
      });
  });

  test("one profile from https with given executor", (done) => {
    syncRequest.mockImplementation(() => {
      return {
        getBody(encoding) {
          return "{\"profiles\":{\"chrome\":{\"browser\":\"chrome\", \"executor\":\"local\"}}}";
        }
      };
    });

    runOpts.settings.testExecutors.local = {
      getProfiles: (opts) => Promise.resolve(opts.profiles),
      getCapabilities: (profile, opts) => Promise.resolve(profile)
    };

    runOpts.argv.profile = "https://some_fake_url#chrome";

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).toEqual(1);
        expect(resolvedprofiles[0].browser).toEqual("chrome");
        expect(resolvedprofiles[0].executor).toEqual("local");
        done();
      });
  });

  test("one profile with five duplicate browsers should return one unique browser", (done) => {
    runOpts.argv.profile = "http://some_fake_url#chrome,chrome,chrome,chrome,chrome";

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).toEqual(1);
        expect(resolvedprofiles[0].browser).toEqual("chrome");
        expect(resolvedprofiles[0].executor).toEqual("sauce");
        done();
      });
  });

  test("multiple profiles from http", (done) => {
    runOpts.argv.profile = "http://some_fake_url#chrome,firefox";

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).toEqual(2);
        expect(resolvedprofiles[0].browser).toEqual("chrome");
        expect(resolvedprofiles[0].executor).toEqual("sauce");
        expect(resolvedprofiles[1].browser).toEqual("firefox");
        expect(resolvedprofiles[1].executor).toEqual("sauce");
        done();
      });
  });

  test("multiple profiles with one duplicate and one unique browser should return two browsers", (done) => {
    runOpts.argv.profile = "http://some_fake_url#chrome,firefox,firefox";

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).toEqual(2);
        expect(resolvedprofiles[0].browser).toEqual("chrome");
        expect(resolvedprofiles[0].executor).toEqual("sauce");
        expect(resolvedprofiles[1].browser).toEqual("firefox");
        expect(resolvedprofiles[1].executor).toEqual("sauce");
        done();
      });
  });

  test("multiple profiles with two duplicate browsers should return two browsers", (done) => {
    runOpts.argv.profile = "http://some_fake_url#chrome,firefox,firefox,chrome";

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).toEqual(2);
        expect(resolvedprofiles[0].browser).toEqual("chrome");
        expect(resolvedprofiles[0].executor).toEqual("sauce");
        expect(resolvedprofiles[1].browser).toEqual("firefox");
        expect(resolvedprofiles[1].executor).toEqual("sauce");
        done();
      });
  });

  test("multiple profiles with four duplicate and one unique browser should return two browsers", (done) => {
    runOpts.argv.profile = "http://some_fake_url#firefox,chrome,firefox,firefox,firefox";

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).toEqual(2);
        expect(resolvedprofiles[0].browser).toEqual("firefox");
        expect(resolvedprofiles[0].executor).toEqual("sauce");
        expect(resolvedprofiles[1].browser).toEqual("chrome");
        expect(resolvedprofiles[1].executor).toEqual("sauce");
        done();
      });
  });

  it("no profile from url", () => {
    syncRequest.mockImplementation(() => {
      return {
        getBody(encoding) {
          return "{\"profiles\":{}}";
        }
      };
    });

    runOpts.argv.profile = "https://some_fake_url#chrome";

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        assert(false, "shouldn't be here");
      })
      .catch((err) => {
        expect(err).toEqual("Profile chrome not found!");
        done();
      });
  });

  test("no profile matches from url", (done) => {
    runOpts.argv.profile = "https://some_fake_url#internet";

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        assert(false, "shouldn't be here");
      })
      .catch((err) => {
        expect(err).toEqual("Profile internet not found!");
        done();
      });
  });

  test("no executor found for profile", (done) => {
    syncRequest.mockImplementation(() => {
      return {
        getBody(encoding) {
          return "{\"profiles\":{\"firefox\":{\"browser\":\"firefox\", \"executor\":\"local\"}}}";
        }
      };
    });
    runOpts.argv.profile = "https://some_fake_url#firefox";

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        assert(false, "shouldn't be here");
      })
      .catch((err) => {
        expect(err).toEqual("Executor local not found! You'll need to configure it in magellan.json");
        done();
      });
  });

  test("getCapabilities failed", (done) => {
    runOpts.settings.testExecutors.sauce.getCapabilities = () => Promise.reject(new Error("FAKE_ERROR"));

    runOpts.argv.profile = "https://some_fake_url#chrome";

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        assert(false, "shouldn't be here");
      })
      .catch((err) => {
        expect(err.message).toEqual("FAKE_ERROR");
        done();
      });
  });
});

describe("Read from local", () => {
  beforeEach(() => {
    runOpts = _.cloneDeep(opts);
  });

  test("one profile", (done) => {
    runOpts.profiles = [
      { browser: "chrome" }
    ];

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).toEqual(1);
        expect(resolvedprofiles[0].browser).toEqual("chrome");
        done();
      });
  });

  test("multiple profiles", (done) => {
    runOpts.profiles = [
      { browser: "chrome" },
      { browser: "firefox" },
      { browser: "internet explorer" }
    ];

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).toEqual(3);
        expect(resolvedprofiles[0].browser).toEqual("chrome");
        expect(resolvedprofiles[1].browser).toEqual("firefox");
        expect(resolvedprofiles[2].browser).toEqual("internet explorer");
        done();
      });
  });

  it("multiple executors", (done) => {
    runOpts.profiles = [
      { browser: "chrome" }
    ];

    runOpts.settings.testExecutors.local = {
      getProfiles: (opts) => Promise.resolve(opts.profiles)
    };

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).toEqual(2);
        expect(resolvedprofiles[0].browser).toEqual("chrome");
        expect(resolvedprofiles[1].browser).toEqual("chrome");
        done();
      });
  });

  test("failed", (done) => {
    runOpts.profiles = [
      { browser: "chrome" }
    ];

    runOpts.settings.testExecutors.sauce.getProfiles = () => Promise.reject(new Error("FAKE_ERROR"));

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        assert(false, "shouldn't be here");
      })
      .catch((err) => {
        expect(err.message).toEqual("FAKE_ERROR");
        done();
      });
  });

  test("profile.toString", (done) => {
    runOpts.profiles = [
      {
        browserName: "chrome",
        version: 10,
        resolution: "1x1",
        orientation: "upright",
        executor: "on mars",
        id: "chrome"
      }
    ];

    profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).toEqual(1);
        expect(resolvedprofiles[0].toString())
          .toEqual("env:chrome|executor:on mars");
        done();
      });
  });
});
