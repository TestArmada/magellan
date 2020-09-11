"use strict";

const _ = require("lodash");
const clc = require("cli-color");
const EventEmitter = require("events").EventEmitter;
const StreamSlicer = require("stream-slic3r");
const { Transform } = require("stream");

const logger = require("../logger");
const logStamp = require("./logstamp");

const MESSAGE = "message";
const CLOSE = "close";

const NOT_GOOD_ENUFF_ERROR_MESSAGE = "Connection refused! Is selenium server started?";
const ADDED_ERROR_MESSAGE_CONTEXT = "If running on saucelabs, perhaps " +
    "you're out of capacity and should TRY RUN AGAIN LATER :)";

// MAKE NIGHWATCH ERROR & WARN LOGS VISIBLE IN MAGELLAN STDOUT:
// ------------------------------------------------------------------------------------------------
// Currently the "ERROR" and "WARN" logs from nightwatch are suppressed when the "DEBUG" flag is
// turned OFF.. and our customers ALWAYS use the "DEBUG" off, because if you turn it on your log
// will be filled with base64 screenshot gobbledegook... Also, with the approach taken, we will
// see all the "ERRORED" selenium request/response logs in our magellan log
//
// relevant code for this feature:
//   DEBUG, STDOUT_WHITE_LIST, SLICE_ON_TEXT, infoSlicer, isTextWhiteListed
// ------------------------------------------------------------------------------------------------

// if the "this.handler.stdout" stream of the childprocess does not
// include atleast one of these tokens then it will not be included in the "this.stdout"
const STDOUT_WHITE_LIST = [
  "\x1B[1;33mERROR\x1B[0m",
  "\x1B[1;32m\x1B[40mWARN\x1B[0m",
  "Test Suite",
  "✖",
  "✔",
  "Running:",
  "OK."
];

// we slice the VERBOSE nighwatch stdout stream on the purple INFO text that has black background
const SLICE_ON_TEXT = "\x1B[1;35m\x1B[40mINFO\x1B[0m";

module.exports = class ChildProcess {
  constructor(handler) {
    this.stdout = `${clc.yellowBright(logStamp())} =====> Magellan child process start\n`;
    this.stderr = "";
    this.handler = handler;

    // create the nightwtach INFO slicer:
    // if the stdout stream does not contain SLICE_ON_TEXT,
    // then the entire stdout will be emitted 'data' with nothing sliced out
    // otherwise the stream will be sliced on nighwatch INFO text (purple with black background)
    // and each "slice" will be emitted 'data'
    const infoSlicer = new StreamSlicer(SLICE_ON_TEXT);

    // create the stdout filtering transform, only nightwatch INFO chunks that are white-listed
    const self = this;
    const stdoutFilter = new Transform({
      transform(data, encoding, callback) {
        let text = data.toString().trim();
        if (text.length > 0 && self.isTextWhiteListed(text)) {
          if (text.includes("✔") || text.includes("Running:") || text.includes("OK.")) {
            // for successful chunks we really only want to keep specific lines
            const lines = text.split("\n");
            const buff = [];
            const maxLineLength = 512;
            const processLine = (line) => {
              if (self.isTextWhiteListed(line)) {
                // limit the length of each line, goal here is to "limit" verbosity
                buff.push(line.substring(0, maxLineLength));
              }
            };
            lines.forEach(line => processLine(line));
            text = buff.join("\n");
          }
          text = text
            .split("\n")
            .filter((line) => !_.isEmpty(line.trim()))
            .map((line) => `\n${clc.yellowBright(logStamp())} ${line}`)
            .join("\n");
          self.stdout += text + "\n";
          self.addErrorMessageContext();
          this.push(text);
        }
        callback();
      }
    });

    this.emitter = new EventEmitter();
    this.emitter.stdout = stdoutFilter;
    this.emitter.stderr = handler.stderr;
    this.emitter.infoSlicer = infoSlicer;

    // pipe the stdout stream into the slicer and then into the filter
    this.handler.stdout.pipe(infoSlicer).pipe(stdoutFilter);
  }

  enableDebugMsg() {
    this.handler.on(MESSAGE, (msg) => {
      logger.debug(`Message from worker: ${JSON.stringify(msg)}`);
    });
  }

  onMessage(callback) {
    this.handler.on(MESSAGE, (message) => callback(message));
  }

  addErrorMessageContext() {
    if (this.stdout.includes(NOT_GOOD_ENUFF_ERROR_MESSAGE)) {
      if (!this.stdout.includes(ADDED_ERROR_MESSAGE_CONTEXT)) {
        const replacement = `${NOT_GOOD_ENUFF_ERROR_MESSAGE}\n${clc.yellowBright(logStamp())}`
          .concat(clc.red(ADDED_ERROR_MESSAGE_CONTEXT));
        this.stdout = this.stdout.replace(NOT_GOOD_ENUFF_ERROR_MESSAGE, replacement);
      }
    }
  }

  isTextWhiteListed(text) {
    if (process.env.DEBUG) {
      // in debug mode we do not filter out any text
      return true;
    }
    return STDOUT_WHITE_LIST.some(item => text.includes(item));
  }

  onClose(callback) {
    this.handler.on(CLOSE, callback);
  }

  send(message) {
    this.handler.send(message);
  }

  teardown() {
    this.handler.stdout.removeAllListeners();
    this.handler.stderr.removeAllListeners();
    this.handler.stdout.unpipe();
    this.handler.stderr.unpipe();
    this.handler.removeAllListeners();

    this.emitter.stdout = null;
    this.emitter.stderr = null;
  }

  emitMessage(message) {
    this.emitter.emit(MESSAGE, message);
  }
};
