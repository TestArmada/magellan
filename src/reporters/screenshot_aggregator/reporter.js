"use strict";

var fs = require("fs");
var glob = require("glob");
var request = require("request");
var Q = require("q");
var slugify = require("slugify");
var settings = require("./settings");
var path = require("path");
var async = require("async");
var BaseReporter = require("../reporter");
var util = require("util");

var MAX_CONCURRENT_UPLOADS = 2;

function ScreenshotAggregator(opts) {
  this.console = console;
  /* istanbul ignore next */
  if (opts && opts.console) {
    this.console = opts.console;
  }

  this.request = request;
  /* istanbul ignore next */
  if (opts && opts.request) {
    this.request = opts.request;
  }

  this.fs = fs;
  /* istanbul ignore next */
  if (opts && opts.fs) {
    this.fs = opts.fs;
  }

  this.glob = glob;
  /* istanbul ignore next */
  if (opts && opts.glob) {
    this.glob = opts.glob;
  }

  this.settings = settings;
  /* istanbul ignore next */
  if (opts && opts.settings) {
    this.settings = opts.settings;
  }

  this.path = path;
  /* istanbul ignore next */
  if (opts && opts.path) {
    this.path = opts.path;
  }

  // This is an URL where we've stored screenshots at for this entire build (regardless of subtests)
  // If we successfully upload any screenshots, this value will be assigned.
  this.buildURL = null;

  this.q = async.queue(this._uploadImage.bind(this), MAX_CONCURRENT_UPLOADS);
  this.q.drain = this.onQueueDrained.bind(this);
  // If this property is set, then onQueueDrained must resolve this deferred's promise.
  this.deferFlush = null;
  this.counter = 0;
}

util.inherits(ScreenshotAggregator, BaseReporter);

ScreenshotAggregator.prototype.initialize = function () {
  var deferred = Q.defer();

  if (!this.settings.aggregatorURL) {
    deferred.reject(new Error("ScreenshotAggregator is missing an aggregatorURL"
      + " in its configuration"));
  } else {
    deferred.resolve();
  }

  return deferred.promise;
};

ScreenshotAggregator.prototype.listenTo = function (testRun, test, source) {
  source.addListener("message", this._handleMessage.bind(this, testRun, test));
};

ScreenshotAggregator.prototype._uploadImage = function (image, callback) {
  this.counter++;

  var formData = {
    /*eslint-disable camelcase */
    build_id: image.buildId,
    child_build_id: image.childBuildId,
    imagefile: {
      value: this.fs.createReadStream(image.localFilePath),
      options: {
        filename: image.intendedFilename,
        contentType: "image/png"
      }
    }
  };

  this.request.post({
    url: this.settings.aggregatorURL,
    formData: formData
  }, function (err, httpResponse, body) {
    var result;
    try {
      result = JSON.parse(body);
    } catch (e) {
      // NOTE: For the moment, we eat and ignore upload errors.
      err = e;
    }

    if (!err && result && result.status === "success") {
      this.buildURL = result.buildURL;
    } else {
      this.console.error("Error uploading screenshot to screenshot service. ", err);
    }

    callback();
  }.bind(this));
};

ScreenshotAggregator.prototype._getScreenshots = function (tempDir) {
  return this.glob.sync(this.path.resolve(tempDir) + "/*.png").concat(
    this.glob.sync(this.path.resolve(tempDir) + "/*.PNG"));
};

ScreenshotAggregator.prototype._deleteScreenshots = function (tempDir) {
  // I couldn't figure out how to make nocase: true work -- it just produces empty results
  var self = this;
  this._getScreenshots(tempDir).forEach(function (screenshotPath) {
    self.fs.unlinkSync(screenshotPath);
  });
};

// Collect screenshots and queue them for uploading to a remote screenshot storage service.
ScreenshotAggregator.prototype._collectScreenshots = function (tempDir, buildId, testName,
    browserId) {
  //
  //
  // TODO: resolve apparent ambiguity when the same browserId is used
  //       multiple times in parallel but with different resolutions
  //       and/or orientations
  // TODO: consider shifting slug generation over to TestRun class to avoid specializing
  //       in disambiguating here.
  //
  //
  var childBuildId = slugify(testName + "_" + browserId);
  var shots = this._getScreenshots(tempDir);

  shots.forEach(function (filePath) {
    var fullPath = this.path.resolve(filePath);
    var intendedFilename = fullPath;
    /*eslint-disable no-magic-numbers */
    if (fullPath.indexOf("/") > -1) {
      intendedFilename = fullPath.split("/").pop();
    }
    this.q.push({
      localFilePath: fullPath,
      intendedFilename: intendedFilename,
      buildId: slugify(buildId),
      childBuildId: childBuildId
    });
  }.bind(this));
};

ScreenshotAggregator.prototype.onQueueDrained = function () {
  // if deferFlush has been set, it means we tried to call flush() while the upload queue
  // was still running. If this is the case, onQueueDrained has been called while an external
  // test runner is paused, waiting for
  if (this.deferFlush) {
    this.deferFlush.resolve();
  }
};

// Summarize our results to the screen or optionally promise that we will, since summarizing
// might require pending screenshots to finish uploading.
ScreenshotAggregator.prototype.flush = function () {
  this.console.log("");

  var showSummary = function () {
    if (this.counter > 0) {
      this.console.log("There " + (this.counter > 1 ? "are " : "is ") + this.counter + " screenshot"
        + (this.counter > 1 ? "s" : "") + " of this build available at " + this.buildURL);
    } else {
      this.console.log("Screenshot aggregator enabled, but no screenshots were uploaded.");
    }
  }.bind(this);

  if (this.q.idle()) {
    return showSummary();
  } else {
    var awaitedUploads = this.q.length() + this.q.running();
    this.console.log("Screenshot aggregator is waiting for " + (awaitedUploads > 1 ? awaitedUploads
      + " screenshots" : " screenshot") + " to finish uploading..");

    var deferSummary = Q.defer();

    // Set up a deferred for
    this.deferFlush = Q.defer();
    this.deferFlush.promise.then(function () {
      showSummary();
      deferSummary.resolve();
    });

    // return a promise that we'll show a summary once uploads have completed
    return deferSummary.promise;
  }
};

ScreenshotAggregator.prototype._handleMessage = function (testRun, test, message) {
  if (message.type === "worker-status") {
    if (message.status === "finished") {
      var tempDir = testRun.tempAssetPath;

      if (message.passed || test.attempts === test.maxAttempts - 1) {
        // Is this our last attempt ever? Sweep up screenshots from this test run.
        this._collectScreenshots(tempDir, testRun.buildId, message.name,
          test.browser.slug());
      } else {
        // We've failed a test and we're going to retry it again in the future.
        // Delete screenshots generated by this run, we don't care about
        // intermediate results.
        this._deleteScreenshots(tempDir);
      }
    }
  }
};

module.exports = ScreenshotAggregator;
