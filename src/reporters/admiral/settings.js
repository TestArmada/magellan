"use strict";

// Configure Admiral from Jenkins or user set environment variables.

module.exports = {
  enabled: !!process.env.ADMIRAL_AUTH_ID,

  authId: process.env.ADMIRAL_AUTH_ID,
  authToken: process.env.ADMIRAL_AUTH_TOKEN,
  path: process.env.ADMIRAL_PATH,
  hostname: process.env.ADMIRAL_HOST,

  buildId: process.env.MAGELLAN_BUILD_ID,
  buildName: process.env.MAGELLAN_BUILD_NAME,

  buildURL: process.env.BUILD_URL
};
