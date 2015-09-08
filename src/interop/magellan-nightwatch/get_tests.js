var fs = require("fs");
var path  = require("path");
var settings = require("../../settings");

var nightwatchConfigFilePath = settings.nightwatchConfigFilePath;

module.exports = function () {
  var nightwatchConfig;

  try {
    nightwatchConfig = require(path.resolve(nightwatchConfigFilePath));
    console.log("Magellan-nightwatch test iterator found nightwatch configuration at: " + nightwatchConfigFilePath);
  } catch (err) {
    var error = "Magellan-nightwatch test iterator cannot read nightwatch configuration: " + err.toString();
    return;
  }

  var srcFolders = nightwatchConfig.src_folders;

  var allFiles = [];
  srcFolders.forEach(function (folder) {
    var files = fs.readdirSync(path.normalize(folder));
    if (files.length > 0) {
      allFiles = allFiles.concat(files.map(function (f) {
        return path.normalize(folder) + "/" + f;
      }));
    }
  });

  // Ensure we scan for JS only, ignoring README files, etc.
  allFiles = allFiles.filter(function (f) {
    return (f.indexOf(".js") === f.length - 3);
  }).map(function (f) {
    return f.trim();
  });

  return allFiles;
};