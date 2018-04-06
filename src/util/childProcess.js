"use strict";

const _ = require("lodash");
const clc = require("cli-color");
const EventEmitter = require("events").EventEmitter;

const logger = require("../logger");
const logStamp = require("./logstamp");

const MESSAGE = "message";
const DATA = "data";
const CLOSE = "close"

module.exports = class ChildProcess {
  constructor(handler) {
    this.stdout = clc.greenBright(`${logStamp()} Magellan child process start\n`);
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
    this.handler.on(MESSAGE, message => callback(message));
  }

  onDataCallback(data) {
    let text = "" + data;
    if (!_.isEmpty(text.trim())) {
      text = text
        .split("\n")
        .filter(line => !_.isEmpty(line.trim()))
        .map(line => `${logStamp()} ${line}`)
        .join("\n");

      /* istanbul ignore else */
      if (!_.isEmpty(text)) {
        this.stdout += text + "\n";
      } else {
        this.stdout += "\n";
      }
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
