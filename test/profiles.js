"use strict";

const chai = require("chai");
const chaiAsPromise = require("chai-as-promised");
const _ = require("lodash");

const profile = require("../src/profiles");
const logger = require("../src/logger");

chai.use(chaiAsPromise);

const expect = chai.expect;
const assert = chai.assert;

const opts = {
  settings: {
    testExecutors: {
      "sauce": {
        getProfiles: (opts) => {
          return new Promise((resolve) => {
            resolve(opts.profiles);
          });
        },
        getCapabilities: (profile, opts) => {
          return new Promise((resolve) => {
            resolve(profile);
          });
        }
      }
    }
  },
  margs: {
    argv: {}
  },
  syncRequest: (method, url) => {
    return {
      getBody(encoding) {
        return "{\"profiles\":{\"chrome\":{\"browser\":\"chrome\"},\"firefox\":{\"browser\":\"firefox\"}}}";
      }
    };
  }
};

let runOpts = {};

describe("handleProfiles", () => {
  beforeEach(() => {
    runOpts = _.cloneDeep(opts);
  });

  describe("Read from --profile", () => {
    it("one profile from http", () => {
      runOpts.margs.argv.profile = "http://some_fake_url#chrome";

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          expect(resolvedprofiles.length).to.equal(1);
          expect(resolvedprofiles[0].browser).to.equal("chrome");
          expect(resolvedprofiles[0].executor).to.equal("sauce");
        });
    });

    it("one profile from https", () => {
      runOpts.margs.argv.profile = "https://some_fake_url#chrome";

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          expect(resolvedprofiles.length).to.equal(1);
          expect(resolvedprofiles[0].browser).to.equal("chrome");
          expect(resolvedprofiles[0].executor).to.equal("sauce");
        });
    });

    it("one profile from https with given executor", () => {
      runOpts.syncRequest = (method, url) => {
        return {
          getBody(encoding) {
            return "{\"profiles\":{\"chrome\":{\"browser\":\"chrome\", \"executor\":\"local\"}}}";
          }
        };
      };

      runOpts.settings.testExecutors.local = {
        getProfiles: (opts) => {
          return new Promise((resolve) => {
            resolve(opts.profiles);
          });
        },
        getCapabilities: (profile, opts) => {
          return new Promise((resolve) => {
            resolve(profile);
          });
        }
      };
      runOpts.margs.argv.profile = "https://some_fake_url#chrome";

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          expect(resolvedprofiles.length).to.equal(1);
          expect(resolvedprofiles[0].browser).to.equal("chrome");
          expect(resolvedprofiles[0].executor).to.equal("local");
        });
    });

    it("one profile with five duplicate browsers should return one unique browser", () => {
      runOpts.margs.argv.profile = "http://some_fake_url#chrome,chrome,chrome,chrome,chrome";

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          expect(resolvedprofiles.length).to.equal(1);
          expect(resolvedprofiles[0].browser).to.equal("chrome");
          expect(resolvedprofiles[0].executor).to.equal("sauce");
        });
    });

    it("multiple profiles from http", () => {
      runOpts.margs.argv.profile = "http://some_fake_url#chrome,firefox";

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          expect(resolvedprofiles.length).to.equal(2);
          expect(resolvedprofiles[0].browser).to.equal("chrome");
          expect(resolvedprofiles[0].executor).to.equal("sauce");
          expect(resolvedprofiles[1].browser).to.equal("firefox");
          expect(resolvedprofiles[1].executor).to.equal("sauce");
        });
    });

    it("multiple profiles with one duplicate and one unique browser should return two browsers", () => {
      runOpts.margs.argv.profile = "http://some_fake_url#chrome,firefox,firefox";

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          expect(resolvedprofiles.length).to.equal(2);
          expect(resolvedprofiles[0].browser).to.equal("chrome");
          expect(resolvedprofiles[0].executor).to.equal("sauce");
          expect(resolvedprofiles[1].browser).to.equal("firefox");
          expect(resolvedprofiles[1].executor).to.equal("sauce");
        });
    });

    it("multiple profiles with two duplicate browsers should return two browsers", () => {
      runOpts.margs.argv.profile = "http://some_fake_url#chrome,firefox,firefox,chrome";

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          expect(resolvedprofiles.length).to.equal(2);
          expect(resolvedprofiles[0].browser).to.equal("chrome");
          expect(resolvedprofiles[0].executor).to.equal("sauce");
          expect(resolvedprofiles[1].browser).to.equal("firefox");
          expect(resolvedprofiles[1].executor).to.equal("sauce");
        });
    });

    it("multiple profiles with four duplicate and one unique browser should return two browsers", () => {
      runOpts.margs.argv.profile = "http://some_fake_url#firefox,chrome,firefox,firefox,firefox";

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          expect(resolvedprofiles.length).to.equal(2);
          expect(resolvedprofiles[0].browser).to.equal("firefox");
          expect(resolvedprofiles[0].executor).to.equal("sauce");
          expect(resolvedprofiles[1].browser).to.equal("chrome");
          expect(resolvedprofiles[1].executor).to.equal("sauce");
        });
    });

    it("no profile from url", () => {
      runOpts.syncRequest = (method, url) => {
        return {
          getBody(encoding) {
            return "{\"profiles\":{}}";
          }
        };
      };
      runOpts.margs.argv.profile = "https://some_fake_url#chrome";

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          assert(false, "shouldn't be here");
        })
        .catch((err) => {
          expect(err).to.equal("Profile chrome not found!");
        });
    });

    it("no profile matches from url", () => {
      runOpts.margs.argv.profile = "https://some_fake_url#internet";

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          assert(false, "shouldn't be here");
        })
        .catch((err) => {
          expect(err).to.equal("Profile internet not found!");
        });
    });

    it("no executor found for profile", () => {
      runOpts.syncRequest = (method, url) => {
        return {
          getBody(encoding) {
            return "{\"profiles\":{\"firefox\":{\"browser\":\"firefox\", \"executor\":\"local\"}}}";
          }
        };
      };
      runOpts.margs.argv.profile = "https://some_fake_url#firefox";

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          assert(false, "shouldn't be here");
        })
        .catch((err) => {
          expect(err).to.equal("Executor local not found! You\'ll need to configure it in magellan.json");
        });
    });

    it("getCapabilities failed", () => {
      runOpts.settings.testExecutors.sauce.getCapabilities = () => {
        return new Promise((resolve, reject) => {
          reject(new Error("FAKE_ERROR"));
        });
      };

      runOpts.margs.argv.profile = "https://some_fake_url#chrome";

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          assert(false, "shouldn't be here");
        })
        .catch((err) => {
          expect(err.message).to.equal("FAKE_ERROR");
        });
    });
  });

  describe("Read from local", () => {
    it("one profile", () => {
      runOpts.profiles = [
        { browser: "chrome" }
      ];

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          expect(resolvedprofiles.length).to.equal(1);
          expect(resolvedprofiles[0].browser).to.equal("chrome");
        });
    });

    it("multiple profiles", () => {
      runOpts.profiles = [
        { browser: "chrome" },
        { browser: "firefox" },
        { browser: "internet explorer" }
      ];

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          expect(resolvedprofiles.length).to.equal(3);
          expect(resolvedprofiles[0].browser).to.equal("chrome");
          expect(resolvedprofiles[1].browser).to.equal("firefox");
          expect(resolvedprofiles[2].browser).to.equal("internet explorer");
        });
    });

    it("multiple executors", () => {
      runOpts.profiles = [
        { browser: "chrome" }
      ];

      runOpts.settings.testExecutors.local = {
        getProfiles: (opts) => {
          return new Promise((resolve) => {
            resolve(opts.profiles);
          });
        }
      };

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          expect(resolvedprofiles.length).to.equal(2);
          expect(resolvedprofiles[0].browser).to.equal("chrome");
          expect(resolvedprofiles[1].browser).to.equal("chrome");
        });
    });

    it("failed", () => {
      runOpts.profiles = [
        { browser: "chrome" }
      ];

      runOpts.settings.testExecutors.sauce.getProfiles = () => {
        return new Promise((resolve, reject) => {
          reject(new Error("FAKE_ERROR"));
        });
      };

      return profile
        .detectFromCLI(runOpts)
        .then((resolvedprofiles) => {
          assert(false, "shouldn't be here");
        })
        .catch((err) => {
          expect(err.message).to.equal("FAKE_ERROR");
        });
    });
  });

  it("profile.toString", () => {
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

    return profile
      .detectFromCLI(runOpts)
      .then((resolvedprofiles) => {
        expect(resolvedprofiles.length).to.equal(1);
        expect(resolvedprofiles[0].toString())
          .to.equal("env:chrome|executor:on mars");
      });
  });
});
