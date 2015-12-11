var fs = require("fs");
var path  = require("path");
var settings = require("../../settings");
var clc = require("cli-color");

var nightwatchConfigFilePath = settings.nightwatchConfigFilePath;

var filterFiles = function (files) {
  return files.filter(function (f) {
    return (f.indexOf(".js") === f.length - 3);
  }).map(function (f) {
    return f.trim();
  });
};

module.exports = function () {
  var nightwatchConfig;

  try {
    nightwatchConfig = require(path.resolve(nightwatchConfigFilePath));
    console.log("Magellan-nightwatch test iterator found nightwatch configuration at: " + nightwatchConfigFilePath);
  } catch (err) {
    throw new Error("Magellan-nightwatch test iterator cannot read nightwatch configuration: " + err.toString());
  }

  if (!nightwatchConfig.src_folders) {
    throw new Error("Magellan-nightwatch test iterator cannot find tests: src_folders in nightwatch configuration is missing");
  }

  if (nightwatchConfig.src_folders.length === 0) {
    throw new Error("Magellan-nightwatch test iterator cannot find tests: src_folders in nightwatch configuration is present, but empty");
  }

  var srcFolders = nightwatchConfig.src_folders;

  var allFiles = [];
  srcFolders.forEach(function (folder) {
    var p = path.normalize(folder);
    console.log("Scanning " + p + " for test files ...");
    var files = fs.readdirSync(p);

    if (files.length > 0) {
      var additionalFiles = filterFiles(files.map(function (f) {
        return path.normalize(folder) + "/" + f;
      }));
      if (additionalFiles.length > 0 ) {
        console.log(clc.green("Found " + additionalFiles.length + " test files in " + p));
      } else {
        console.log(clc.yellow("Found no test files in " + p));
      }
      allFiles = allFiles.concat(additionalFiles);
    }
  });

  return allFiles;
};