"use strict";

const _ = require("lodash");
const hostedProfiles = require("./hosted_profiles");

class Profile {
  constructor(p) {
    _.forEach(p, (v, k) => {
      this[k] = v;
    });
  }

  toString() {
    let cap = this.desiredCapabilities || this;

    return cap.browserName
      + (cap.version ? "|version:" + cap.version : "")
      + (cap.resolution ? "|resolution:" + cap.resolution : "")
      + (cap.orientation ? "|orientation:" + cap.orientation : "")
      + "|executor:" + this.executor;
  }
};

module.exports = {
  detectFromCLI: (opts) => {
    // runOpts.margs.argv, runOpts.settings.testExecutors
    /**
     * Handle following command argument
     * --profile
     * 
     */
    const runOpts = _.assign({
      console
    }, opts);

    const argv = runOpts.margs.argv;
    const testExecutors = runOpts.settings.testExecutors;

    return new Promise((resolve, reject) => {
      let profiles = [];

      if (argv.profile) {
        // If a profile key is specified, look to argv for it and use it. If
        // a browser is set ia CLI, we assume details from the stored profile
        // and override with anything else explicitly set.
        if (argv.profile.indexOf("http:") > -1 || argv.profile.indexOf("https:") > -1) {
          // We fetch profiles from an URL if it starts with http: or https:
          // We assume it will have a #fragment to identify a given desired profile.
          // Note: The hosted profiles are merged on top of any local profiles.
          const remoteProfileURL = argv.profile.split("#")[0];
          const fetchedProfiles = hostedProfiles.getProfilesAtURL(remoteProfileURL, opts);

          if (fetchedProfiles && fetchedProfiles.profiles) {
            argv.profiles = _.extend({}, argv.profiles, fetchedProfiles.profiles);

            runOpts.console.log("Loaded hosted profiles from " + remoteProfileURL);
          }

          argv.profile = hostedProfiles.getProfileNameFromURL(argv.profile);
        }

        runOpts.console.log("Requested profile(s): ", argv.profile);

        // NOTE: We check "profiles" (plural) here because that's what has
        // the actual profile definition. "profile" is the argument from the
        // command line. "profiles" is the list structure in magellan.json.
        if (argv.profiles && Object.keys(argv.profiles).length > 0) {
          let requestedProfiles;

          // Generate a list of profiles, which may typically be just one profile.
          if (argv.profile.indexOf(",") > -1) {
            requestedProfiles = argv.profile.split(",");
          } else if (argv.profiles.hasOwnProperty(argv.profile)) {
            requestedProfiles = [argv.profile];
          }

          // Search for the requested profiles and resolve their profiles
          if (requestedProfiles) {
            const notFoundProfiles = [];

            _.forEach(requestedProfiles, (requestedProfile) => {
              if (argv.profiles[requestedProfile]) {
                profiles = _.concat(profiles, argv.profiles[requestedProfile]);
              } else {
                notFoundProfiles.push(requestedProfile);
              }
            });

            if (notFoundProfiles.length > 0) {
              reject("Profile(s) " + notFoundProfiles.join(",") + " not found!");
            }

            if (argv.debug) {
              runOpts.console.log(" Selected profiles: ");
              _.forEach(profiles, (p) => {
                let str = [];

                _.map(p, (v, k) => {
                  str.push(k + ": " + v);
                });
                runOpts.console.log("  " + str.join(", "));
              });
            }

            // convert profile to an executor-understandable capabilities
            let profileResolvePromises = [];

            _.forEach(profiles, (profile) => {
              // we treat all profiles with sauce executor by default
              profile.executor = "sauce";

              if (executors[profile.executor]) {
                profileResolvePromises.push(executors[profile.executor].getCapabilities(profile));
              } else {
                reject("Executor " + profile.executor + " not found! You'll need to configure"
                  + " it in magellan.json");
              }
            });

            Promise
              .all(profileResolvePromises)
              .then((targetProfiles) => {
                let resolvedprofiles = [];

                if (targetProfiles && targetProfiles.length > 0) {
                  _.forEach(targetProfiles, (tp) => {
                    resolvedprofiles.push(new Profile(tp));
                  });
                }
                resolve(resolvedprofiles);
              })
              .catch((err) => {
                reject(err);
              });

          } else {
            reject("Profile " + argv.profile + " not found!");
          }
        } else {
          reject("Profile " + argv.profile + " not found!");
        }
      } else {
        // user passes profile information from command line directly, like --local_browser or some params tighted to an executor
        let profileResolvePromises = [];

        _.forEach(testExecutors, (executor) => {
          profileResolvePromises.push(executor.getProfiles(opts));
        });

        Promise
          .all(profileResolvePromises)
          .then((targetProfiles) => {
            let resolvedprofiles = [];

            if (targetProfiles && targetProfiles.length > 0) {
              const flattenTargetProfiles = _.flatten(targetProfiles);

              _.forEach(flattenTargetProfiles, (tp) => {
                if (tp) {
                  resolvedprofiles.push(new Profile(tp));
                }
              });
            }
            resolve(resolvedprofiles);
          })
          .catch((err) => {
            reject(err);
          });
      }
    });
  }
};