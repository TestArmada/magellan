var sauceBrowsers = require("./sauce/browsers.js");
var Q = require("q");
var hostedProfiles = require("./hosted_profiles");
var _ = require("lodash");

var Browser = function (id, resolution, orientation) {
  var result = {
    slug: function () {
      return this.browserId
        + (this.resolution ? "_" + this.resolution : "")
        + (this.orientation ? "_" + this.orientation : "");
    },
    toString: function () {
      return (this.browserId
        + (this.resolution ? " @" + this.resolution : "")
        + (this.orientation ? " orientation: " + this.orientation : ""));
    },
    browserId: id,
    resolution: resolution ? resolution.trim() : undefined,
    orientation: orientation ? orientation.trim() : undefined
  };
  return result;
};

module.exports = {

  // Return a promise that we'll resolve with a list of browsers selected
  // by the user from command line arguments
  detectFromCLI: function (argv, sauceEnabled, isNodeBased) {
    var deferred = Q.defer();
    var browsers;

    // If a profile key is specified, look to argv for it and use it. If
    // a browser is set ia CLI, we assume details from the stored profile 
    // and override with anything else explicitly set.
    if (argv.profile) {

      if (argv.profile.indexOf("http:") > -1 || argv.profile.indexOf("https:") > -1) {
        // We fetch profiles from an URL if it starts with http: or https:
        // We assume it will have a #fragment to identify a given desired profile.
        // Note: The hosted profiles are merged on top of any local profiles.
        var fetchedProfiles = hostedProfiles.getProfilesAtURL(argv.profile.split("#")[0]);
        if (fetchedProfiles && fetchedProfiles.profiles) {
          argv.profiles = _.extend({}, argv.profiles, fetchedProfiles.profiles);

          console.log("Loaded hosted profiles from " + argv.profile.split("#")[0]);
        }

        argv.profile = hostedProfiles.getProfileNameFromURL(argv.profile);
      }

      console.log("Requested profile(s): ", argv.profile);

      // NOTE: We check "profiles" (plural) here because that's what has
      // the actual profile definition. "profile" is the argument from the
      // command line. "profiles" is the list structure in magellan.json.
      if (argv.profiles && Object.keys(argv.profiles).length > 0) {
        var requestedProfiles;

        // Generate a list of profiles, which may typically be just one profile.
        if (argv.profile.indexOf(",") > -1) {
          requestedProfiles = argv.profile.split(",");
        } else {
          if (argv.profiles.hasOwnProperty(argv.profile)) {
            requestedProfiles = [argv.profile];
          }
        }

        // Search for the requested profiles and copy their browsers to browsers[]
        if (requestedProfiles) {
          browsers = [];
          var notFoundProfiles = [];

          requestedProfiles.forEach(function (requestedProfile) {
            if (argv.profiles.hasOwnProperty(requestedProfile)) {
              argv.profiles[requestedProfile].forEach(function (b) {
                browsers.push(Browser(b.browser, b.resolution, b.orientation));
              });
            } else {
              notFoundProfiles.push(requestedProfile);
            }
          });

          if (notFoundProfiles.length > 0) {
            deferred.reject("Profile(s) " + notFoundProfiles.join(",") + " not found!");
            return;
          }
        } else {
          deferred.reject("Profile " + argv.profile + " not found!");
          return;
        }
      } else {
        deferred.reject("Profile " + argv.profile + " not found!");
      }
    }

    if (argv.browser && argv.browser.indexOf(",") > -1) {
      argv.browsers = argv.browser;
    }

    // Note: "browsers" always trumps a single "browser" and will overwrite
    // anything from a profile completely.
    if (argv.browsers) {
      browsers = argv.browsers.split(",").map(function (browser) {
        // NOTE: This applies the same orientation value to all browsers, regardless of whether it's appropriate or not
        // For better per-browser control, it's better to use browser profiles.
        return Browser(browser.trim(), argv.resolution, argv.orientation);
      });
    } else if (argv.browser) {
      var singleBrowser = Browser(argv.browser, argv.resolution, argv.orientation);

      if (argv.profile) {
        // If we've loaded a profile from magellan.json, the --browser option
        // merely narrows down which of the profiles we're using.
        // Select argv.browser *from* the existing list of browsers, which
        // have already been loaded via argv.profile
        browsers = browsers.filter(function (b) {
          return b.browserId === argv.browser.trim();
        });
      } else {
        browsers = [singleBrowser];
      }
    } else {
      // If we don't have a browser list yet from profiles or wherever else, then
      // we fall back on default behavior.
      if (browsers) {
        if (!sauceEnabled) {
          //
          // TODO: Check browsers from profile are correct for not-sauce
          //
        } else {
          //
          // TODO: check sauce mode browsers here? or have they already been checked?
          //
        }
      } else {
        if (sauceEnabled) {
          browsers = [];
        } else {
          var fallbackBrowser;
          if (isNodeBased) {
            fallbackBrowser = Browser("nodejs", argv.resolution, argv.orientation);
          } else {
            fallbackBrowser = Browser("phantomjs", argv.resolution, argv.orientation);
          }
          browsers = [fallbackBrowser];
        }
      }
    }

    // validate browser list if Sauce is enabled
    if (sauceEnabled) {
      sauceBrowsers.initialize(sauceEnabled).then(function () {
        var unrecognizedBrowsers = browsers.filter(function (browser) {
          var browserId = browser.browserId;
          // If we've specified a resolution, validate that this browser supports that exact resolution.
          if (browser.resolution) {
            var b = sauceBrowsers.browser(browserId);
            if (b && b.resolutions && b.resolutions.indexOf(browser.resolution) > -1) {
              // recognized
              return false;
            }
            // unrecognized
            return true;
          } else {
            return !sauceBrowsers.browser(browserId);
          }
        });

        if (unrecognizedBrowsers.length > 0) {
          console.log("Error! Unrecognized saucelabs browsers specified:");
          unrecognizedBrowsers.forEach(function (browser) {
            console.log("  " + browser.browserId + " " + (browser.resolution ? " at resolution: " + browser.resolution : ""));
          });

          // invalidate our result
          browsers = [];
        }

        deferred.resolve(browsers);
      });
    } else {
      deferred.resolve(browsers);
    }

    return deferred.promise;
  }
};