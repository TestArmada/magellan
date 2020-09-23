"use strict";

const StreamSlicer = require("stream-slic3r");
const { Transform } = require("stream");
const logger = require("../../logger");
const HarCaptureEngine = require("./HarCaptureEngine");

/*
* Stdout Reporter
*
* This reporter streams the output from a test run directly to stdout/stderr, to allow
* for easier live debugging at the console.
*/

const BaseReporter = require("../reporter");

const logHarEntryToScreen = (entry, url) => {
  // to make things easier to read ie taking less screen space...
  // reduce the querystring and headers to find on justa few lines
  const reducer = (result, item) => {
    result.push(`${item.name} = ${item.value}`);
    return result;
  };
  entry.request.queryString = entry.request.queryString.reduce(reducer, []);
  entry.request.headers = entry.request.headers.reduce(reducer, []);
  entry.response.headers = entry.response.headers.reduce(reducer, []);
  // report the error to screeen to help user debug
  const tag = "[PageReporter]";
  /* eslint-disable no-console, no-magic-numbers */
  console.log();
  console.log(tag, "============== !!! FAILED_REQUEST_FOUND_ON_PAGE !!! ==============");
  console.log(tag, "== PAGE_URL:", url);
  console.log(tag, "== FAILED_REQUEST:\n", JSON.stringify(entry.request, null, 2));
  console.log(tag, "== FAILED_RESPONSE:\n", JSON.stringify(entry.response, null, 2));
  console.log(tag, "==================================================================");
  console.log();
  /* eslint-enable no-console, no-magic-numbers */
};

const onHarEntry = (entry, url) => {
  if (entry.response && entry.response.status) {
    // if the response is in the 400/500 range then we log it to the screen
    const failedCodeBegin = 400;
    const failedCodeEnd = 600;
    if (entry.response.status >= failedCodeBegin && entry.response.status < failedCodeEnd) {
      logHarEntryToScreen(entry, url);
    }
  }
};

class Reporter extends BaseReporter {

  async initialize() {
    if (!this.harCaptureEngine) {
      this.harCaptureEngine = new HarCaptureEngine();
      await this.harCaptureEngine.start();
    }
  }

  async flush() {
    if (this.harCaptureEngine) {
      await this.harCaptureEngine.stop();
    }
  }

  listenTo(testRun, test, source) {
    if (source.infoSlicer) {
      const sliceOn = "\"url\":\"";
      const urlSlicer = new StreamSlicer(sliceOn);
      const urlParser = new Transform({
        transform(data, encoding, callback) {
          data = data.toString();
          // StreamSlicer has no data loss,
          // the first slice might not contain any url
          // thus we have ths check
          if (data.startsWith(sliceOn)) {
            const endIndex = data.indexOf("\"", sliceOn.length + 1);
            const url = data.substring(sliceOn.length, endIndex);
            this.push(url);
          }
          callback();
        }
      });
      const harCaptureEngine = this.harCaptureEngine;
      const urlHandler = new Transform({
        transform(data, encoding, callback) {
          const _url = data.toString();
          const onHar = har => har.log.entries.forEach(entry => onHarEntry(entry, _url));
          // eslint-disable-next-line no-sequences
          const onFail = (url, err) => logger.err(`HarCaptureEngine.capture.onFail: ${url, err}`);
          harCaptureEngine.capture(_url, onHar, onFail);
          callback();
        }
      });
      source.infoSlicer.pipe(urlSlicer).pipe(urlParser).pipe(urlHandler);
    } else {
      logger.err("PageReporder: source.infoSlicer does not exist!");
    }
  }

}

module.exports = Reporter;
