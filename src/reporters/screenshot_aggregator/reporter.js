"use strict";

const fs = require("fs");
const glob = require("glob");
const request = require("request");
const Q = require("q");
const slugify = require("slugify");
const settings = require("./settings");
const path = require("path");
const async = require("async");
const BaseReporter = require("../reporter");
const _ = require("lodash");

const MAX_CONCURRENT_UPLOADS = 2;

class ScreenshotAggregator extends BaseReporter {
  constructor(opts) {
    super();

    _.assign(this, {
      console,
      request,
      fs,
      glob,
      settings,
      path
    }, opts);

    // This is an URL where we've stored screenshots at for this entire build
    // (regardless of subtests)
    // If we successfully upload any screenshots, this value will be assigned.
    this.buildURL = null;

    this.q = async.queue(this._uploadImage.bind(this), MAX_CONCURRENT_UPLOADS);
    this.q.drain = this.onQueueDrained.bind(this);
    // If this property is set, then onQueueDrained must resolve this deferred's promise.
    this.deferFlush = null;
    this.counter = 0;
  }

  initialize() {
    const deferred = Q.defer();

    if (!this.settings.aggregatorURL) {
      deferred.reject(new Error("ScreenshotAggregator is missing an aggregatorURL"
        + " in its configuration"));
    } else {
      deferred.resolve();
    }

    return deferred.promise;
  }

  listenTo(testRun, test, source) {
    source.addListener("message", this._handleMessage.bind(this, testRun, test));
  }

  _uploadImage(image, callback) {
    this.counter++;

    const formData = {
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
      formData
    }, (err, httpResponse, body) => {
      let result;
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
    });
  }

  _getScreenshots(tempDir) {
    return this.glob.sync(this.path.resolve(tempDir) + "/*.png").concat(
      this.glob.sync(this.path.resolve(tempDir) + "/*.PNG"));
  }

  _deleteScreenshots(tempDir) {
    // I couldn't figure out how to make nocase: true work -- it just produces empty results
    this._getScreenshots(tempDir).forEach((screenshotPath) => {
      this.fs.unlinkSync(screenshotPath);
    });
  }

  // Collect screenshots and queue them for uploading to a remote screenshot storage service.
  _collectScreenshots(tempDir, buildId, testName, browserId) {
    //
    //
    // TODO: resolve apparent ambiguity when the same browserId is used
    //       multiple times in parallel but with different resolutions
    //       and/or orientations
    // TODO: consider shifting slug generation over to TestRun class to avoid specializing
    //       in disambiguating here.
    //
    //
    const childBuildId = slugify(testName + "_" + browserId);
    const shots = this._getScreenshots(tempDir);

    shots.forEach((filePath) => {
      const fullPath = this.path.resolve(filePath);
      let intendedFilename = fullPath;
      /*eslint-disable no-magic-numbers */
      if (fullPath.indexOf("/") > -1) {
        intendedFilename = fullPath.split("/").pop();
      }
      this.q.push({
        localFilePath: fullPath,
        intendedFilename,
        buildId: slugify(buildId),
        childBuildId
      });
    });
  }

  onQueueDrained() {
    // if deferFlush has been set, it means we tried to call flush() while the upload queue
    // was still running. If this is the case, onQueueDrained has been called while an external
    // test runner is paused, waiting for
    if (this.deferFlush) {
      this.deferFlush.resolve();
    }
  }

  // Summarize our results to the screen or optionally promise that we will, since summarizing
  // might require pending screenshots to finish uploading.
  flush() {
    this.console.log("");

    const showSummary = () => {
      if (this.counter > 0) {
        this.console.log("There " + (this.counter > 1 ? "are " : "is ") +
          this.counter + " screenshot" +
          (this.counter > 1 ? "s" : "") + " of this build available at " + this.buildURL);
      } else {
        this.console.log("Screenshot aggregator enabled, but no screenshots were uploaded.");
      }
    };

    if (this.q.idle()) {
      return showSummary();
    } else {
      const awaitedUploads = this.q.length() + this.q.running();
      this.console.log("Screenshot aggregator is waiting for " +
        (awaitedUploads > 1 ? awaitedUploads + " screenshots" : " screenshot") +
        " to finish uploading..");

      const deferSummary = Q.defer();

      // Set up a deferred for
      this.deferFlush = Q.defer();
      this.deferFlush.promise.then(() => {
        showSummary();
        deferSummary.resolve();
      });

      // return a promise that we'll show a summary once uploads have completed
      return deferSummary.promise;
    }
  }

  _handleMessage(testRun, test, message) {
    if (message.type === "worker-status") {
      if (message.status === "finished") {
        const tempDir = testRun.tempAssetPath;

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
  }
}

module.exports = ScreenshotAggregator;
