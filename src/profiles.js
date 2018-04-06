"use strict";

const _ = require("lodash");
const hostedProfiles = require("./hosted_profiles");
const logger = require("./logger");

class Profile {
  constructor(p) {
    _.forEach(p, (v, k) => {
      this[k] = v;
    });
  }

  toString() {
    /* istanbul ignore next */
    return "env:" + this.id + "|executor:" + this.executor;
  }
}

module.exports = {
  detectFromCLI: (opts) => {
    /**
     * Handle following command argument
     * --profile
     *
     */
    const testExecutors = opts.settings.testExecutors;

    return new Promise((resolve, reject) => {
      let profiles = [];

      if (opts.argv.profile) {
        // If a profile key is specified, look to opts.argv for it and use it. If
        // a browser is set ia CLI, we assume details from the stored profile
        // and override with anything else explicitly set.
        if (opts.argv.profile.indexOf("http:") > -1 || opts.argv.profile.indexOf("https:") > -1) {
          // We fetch profiles from an URL if it starts with http: or https:
          // We assume it will have a #fragment to identify a given desired profile.
          // Note: The hosted profiles are merged on top of any local profiles.
          const remoteProfileURL = opts.argv.profile.split("#")[0];
          const fetchedProfiles = hostedProfiles.getProfilesAtURL(remoteProfileURL, opts);

          if (fetchedProfiles && fetchedProfiles.profiles) {
            opts.argv.profiles = _.extend({}, opts.argv.profiles, fetchedProfiles.profiles);

            logger.log("Loaded hosted profiles from " + remoteProfileURL);
          }

          opts.argv.profile = hostedProfiles.getProfileNameFromURL(opts.argv.profile);
        }

        logger.log("Requested profile(s): " + opts.argv.profile);

        // NOTE: We check "profiles" (plural) here because that's what has
        // the actual profile definition. "profile" is the argument from the
        // command line. "profiles" is the list structure in magellan.json.
        if (opts.argv.profiles && Object.keys(opts.argv.profiles).length > 0) {
          let requestedProfiles;

          // Generate a list of profiles, which may typically be just one profile.
          if (opts.argv.profile.indexOf(",") > -1) {
            requestedProfiles = opts.argv.profile.split(",");
          } else if (opts.argv.profiles.hasOwnProperty(opts.argv.profile)) {
            requestedProfiles = [opts.argv.profile];
          }

          // Search for the requested profiles and resolve their profiles
          if (requestedProfiles) {
            const notFoundProfiles = [];

            _.forEach(requestedProfiles, (requestedProfile) => {
              if (opts.argv.profiles[requestedProfile]) {
                // keep only the unique profiles and eliminate duplicates from test run
                profiles = _.uniqWith(
                  _.concat(profiles, opts.argv.profiles[requestedProfile]),
                  _.isEqual
                );
              } else {
                notFoundProfiles.push(requestedProfile);
              }
            });

            if (notFoundProfiles.length > 0) {
              reject("Profile(s) " + notFoundProfiles.join(",") + " not found!");
            }

            logger.debug(" Selected profiles: ");
            _.forEach(profiles, (p) => {
              const str = [];

              _.map(p, (v, k) => {
                str.push(k + ": " + v);
              });
              logger.debug("  " + str.join(", "));
            });

            // convert profile to an executor-understandable capabilities
            const profileResolvePromises = [];

            _.forEach(profiles, (profile) => {
              // we treat all missing profile.executor with sauce executor by default
              if (!profile.executor) {
                profile.executor = "sauce";
              }

              if (testExecutors[profile.executor]) {
                profileResolvePromises.push(
                  testExecutors[profile.executor].getCapabilities(profile, opts));
              } else {
                reject("Executor " + profile.executor + " not found! You'll need to configure"
                  + " it in magellan.json");
              }
            });

            Promise
              .all(profileResolvePromises)
              .then((targetProfiles) => {
                const resolvedprofiles = [];

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
            reject("Profile " + opts.argv.profile + " not found!");
          }
        } else {
          reject("Profile " + opts.argv.profile + " not found!");
        }
      } else {
        // user passes profile information from command line directly,
        // like --local_browser or some params tighted to an executor
        const profileResolvePromises = [];

        _.forEach(testExecutors, (executor) => {
          profileResolvePromises.push(executor.getProfiles(opts));
        });

        Promise
          .all(profileResolvePromises)
          .then((targetProfiles) => {
            const resolvedprofiles = [];

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
