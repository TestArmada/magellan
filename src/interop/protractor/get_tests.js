var fs = require("fs");
var path = require("path");
var settings = require("../../settings");

var protractorConfigFilePath = settings.nightwatchConfigFilePath;

require('songbird')

module.exports = function() {
    var data;

    try {
        data = fs.readFileSync(protractorConfigFilePath, "utf8");
        console.log("Magellan-protractor test iterator found protractor configuration at: " + protractorConfigFilePath);
    } catch (e) {
        var error = "Magellan-protractor test iterator: Error reading protractor configuration at " + protractorConfigFilePath;
        console.error(error);
        return;
    }

    // the file protractorConfigFilePath = conf.js  has an export.config, and not straight JSON, so I cannot parse it the way nightwatch version does
    // for now I am using a similar method like you have done for nightwatch.

    var protractorConfig = JSON.parse(data);
    var srcFolders = protractorConfig.specs;

    // var files = fs.readdirSync(srcFolders);
    // console.log('files'+ files);

    // fs.promise.readdir(srcFolders).then(function(result) {
    //     console.log(" File List retrieved: " + result);
    // });

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
