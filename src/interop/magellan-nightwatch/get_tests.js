var fs = require("fs");
var path  = require("path");
var settings = require("../../settings");

var nightwatchConfigFilePath = settings.nightwatchConfigFilePath;

module.exports = function () {
  var data;

  try {
    data = fs.readFileSync(nightwatchConfigFilePath, "utf8");
    console.log("Magellan-nightwatch test iterator found nightwatch configuration at: " + nightwatchConfigFilePath);
  } catch (e) {
    var error = "Magellan-nightwatch test iterator: Error reading nightwatch configuration at " + nightwatchConfigFilePath;
    console.error(error);
    return;
  }

  var nightwatchConfig = JSON.parse(data);
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