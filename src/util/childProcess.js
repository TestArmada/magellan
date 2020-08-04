"use strict";

const _ = require("lodash");
const clc = require("cli-color");
const EventEmitter = require("events").EventEmitter;

const logger = require("../logger");
const logStamp = require("./logstamp");

const MESSAGE = "message";
const DATA = "data";
const CLOSE = "close";

const NOT_GOOD_ENUFF_ERROR_MESSAGE = "Connection refused! Is selenium server started?";
const ADDED_ERROR_MESSAGE_CONTEXT = "If running on saucelabs, perhaps " +
    "you're out of capacity and should TRY RUN AGAIN LATER :)";

module.exports = class ChildProcess {
  constructor(handler) {
    this.stdout = `${clc.yellowBright(logStamp())} =====> Magellan child process start\n`;
    this.stderr = "";
    this.handler = handler;
    this.handler.stdout.on(DATA, this.onDataCallback.bind(this));
    this.handler.stderr.on(DATA, this.onDataCallback.bind(this));

    this.emitter = new EventEmitter();
    this.emitter.stdout = handler.stdout;
    this.emitter.stderr = handler.stderr;
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
        const replacement = `${NOT_GOOD_ENUFF_ERROR_MESSAGE}\n${clc.yellowBright(logStamp())}`;
        replacement.concat(" ", `${replacement} ${clc.red(ADDED_ERROR_MESSAGE_CONTEXT)}`);
        this.stdout = this.stdout.replace(NOT_GOOD_ENUFF_ERROR_MESSAGE, replacement);
      }
    }
  }

  onDataCallback(data) {
    let text = "" + data;
    if (!_.isEmpty(text.trim())) {
      text = text
        .split("\n")
        .filter((line) => !_.isEmpty(line.trim()))
        .map((line) => `${clc.yellowBright(logStamp())} ${line}`)
        .join("\n");

      /* istanbul ignore else */
      if (!_.isEmpty(text)) {
        this.stdout += text + "\n";
      } else {
        this.stdout += "\n";
      }
      this.addErrorMessageContext();
    }
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
