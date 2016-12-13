"use strict";

var syncRequest = require("sync-request");
var URL = require("url");
var _ = require("lodash");

module.exports = {

  // Return a profile name from an URL if one is referenced with a #fragment.
  // If not, just return nothing. Silently eat errors if there is no fragment
  // or if the URL isn't valid.
  getProfileNameFromURL: function (url) {
    try {
      url = URL.parse(url);
    } catch (e) {
      // don't do anything with this exception
    }
    if (url && url.hash) {
      return url.hash.split("#")[1];
    }
  },

  getProfilesAtURL: function (url, opts) {
    var runOpts = _.assign({
      syncRequest: syncRequest
    }, opts);

    var res = runOpts.syncRequest("GET", url);
    var data;

    try {
      data = JSON.parse(res.getBody("utf8"));
    } catch (e) {
      throw new Error("Could not fetch profiles from " + url);
    }

    if (data && !data.profiles) {
      throw new Error("Profiles supplied at " + url + " are malformed.");
    }

    // return an object that can be used for extending and which
    // is not polluted with any other properties.
    return { profiles: data.profiles };
  }

};
