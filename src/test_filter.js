var path = require("path"),
  fs = require("fs"),
  _ = require("lodash"),
  acorn = require("acorn"),
  clc = require("cli-color"),
  walk = require("acorn/dist/walk"),
  settings = require("./settings");

var filterByTags = function(files, tags) {
  // Tidy up tag input. If we have a comma-delimited list, tokenize and clean it up
  if (typeof tags === "string") {
    tags = tags.trim();

    if (tags.indexOf(",") > -1) {
      tags = tags.trim().split(",").map(function (tag) {
        return tag.trim();
      });
    } else {
      tags = [tags];
    }
  }

  // If tags are empty or malformed, ignore them
  if (!_.isArray(tags) || tags.length === 0) {
    return files;
  }

  console.log("Using tag filter: ", tags);

  // FIXME: Handle an error with an interop that doesn't implement a tag_filter here
  var filterImplementation = require("./interop/" + settings.framework + "/tag_filter");  
  return files.filter(filterImplementation.bind(this, tags));
};

var PREDEFINED_FILTERS = {

  // Filter by "group", which really means filename prefix, i.e:
  //
  //  --group=test/groupname
  //  --group=test/abc/xyz/Regression
  //  --group=test/abc/xyz/Smoke
  //
  group: function(files, partialFilename) {
    console.log("Using group filter: ", partialFilename);

    return files.filter(function(f) {
      var pass = true;

      if (partialFilename) {
        if (typeof partialFilename === "string") {
          partialFilename = [partialFilename];
        }
        pass = partialFilename.some(function(pfn) {
          return f.indexOf(pfn) > -1;
        });
      }

      return (f.indexOf(".js") === f.length - 3) && pass;
    }).map(function(f) {
      return f.trim();
    });
  },

  // Filter by one exact relative filename match, eg:
  // --test=path/to/exact/test/filename.js
  test: function(files, filename) {
    console.log("Using test filter: ", filename);

    return files.filter(function(f) {
      //
      // TODO: instead check if this is an instance of a Path object, not "mocha" substring check
      //
      if (settings.framework.indexOf("mocha") > -1) {
        if (f.path === filename) {
          return true;
        }
      } else {
        if (path.resolve(f.trim()) === path.resolve(filename.trim())) {
          return true;
        }
      }
    });
  },

  // Filter by tag or tags, i.e:
  //
  //  --tag=tagname
  //  --tags=tagname
  //  --tags=tagname1,tagname2
  //
  tag: filterByTags,
  tags: filterByTags

}; 

module.exports = {

  // Detect and return filters specified by command line arguments
  // from an argv object args
  detectFromCLI: function (args) {
    var filters = {};

    _.keys(PREDEFINED_FILTERS).forEach(function (f) {
      if (args[f]) {
        filters[f] = args[f];
      }
    });

    return filters;
  },

  // Successively reduce files to a smaller set of files by
  // running a list of filters on the list repeatedly
  filter: function(files, filters) {
    var allFiles = files;

    _.forEach(filters, function(n, k) {
      if (PREDEFINED_FILTERS[k]) {
        // if we have this filter predefined in settings.js
        // do filter here
        allFiles = PREDEFINED_FILTERS[k](allFiles, filters[k]);
      }
    });

    return allFiles;
  }

};