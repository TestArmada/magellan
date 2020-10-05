"use strict";

const getPort = require("get-port");
const {spawn} = require("child_process");
const CHC = require("chrome-har-capturer");
const logger = require("../../logger");

const CHROME_CMD = {
  MAC: "\"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome\"",
  LINUX: "google-chrome"
};

const CAPTURE_TIMEOUT = 10000; // 10 seconds

class HarCaptureEngine {

  async start() {
    if (!this.chromeProcess) {
      const portRange = [];
      const maxPort = 9999;
      let i = 9223;
      while (i <= maxPort) {
        portRange.push(i++);
      }
      this.port = await getPort({port: portRange});
      const args = [
        "--headless",
        "--crash-dumps-dir=/tmp",
        "--disable-gpu",
        `--remote-debugging-port=${this.port}`
      ];
      const isMac = process.platform === "darwin";
      const cmd = isMac ? CHROME_CMD.MAC : CHROME_CMD.LINUX;
      this.chromeProcess = spawn(cmd, args, {shell: true});
      this.chromeProcess.stdout.on("data", (data) => {
        data = data.toString().trim();
        if (data.length) {
          logger.log(`HarCaptureEngine.chromeProcess.stdout: ${data}`);
        }
      });
      this.chromeProcess.stderr.on("data", (data) => {
        data = data.toString().trim();
        if (data.length) {
          logger.log(`HarCaptureEngine.chromeProcess.stderr: ${data}`);
        }
      });
      this.chromeProcess.on("error", err => {
        logger.err(`HarCaptureEngine.chromeProcess.error: ${err}`);
      });
      this.cache = {};
    }
  }

  getCacheKey(url) {
    return url.toString("base64")
      .split("=").join("_")
      .split("+").join("-")
      .split("/").join("$");
  }

  async capture(url, onHar, onFail) {
    const cacheKey = this.getCacheKey(url);
    if (this.cache[cacheKey]) {
      onHar(this.cache[cacheKey]);
    }
    CHC.run([url], {
      port: this.port,
      timeout: CAPTURE_TIMEOUT
    })
    .on("fail", onFail) // onFail(url, err)
    .on("har", har => {
      this.cache[cacheKey] = har;
      onHar(this.cache[cacheKey]);
    });
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (this.chromeProcess) {
        this.chromeProcess.on("exit", (code, signal) => {
          // eslint-disable-next-line no-sequences
          logger.log(`HarCaptureEngine.chromeProcess.exit: ${code, signal}`);
          resolve();
        });
        this.chromeProcess.on("close", (code, signal) => {
          // eslint-disable-next-line no-sequences
          logger.log(`HarCaptureEngine.chromeProcess.close: ${code, signal}`);
          resolve();
        });
        this.chromeProcess.on("disconnect", () => {
          logger.err("HarCaptureEngine.chromeProcess.disconnect");
          resolve();
        });
        this.chromeProcess.on("error", (err) => reject(err));
        this.chromeProcess.kill("SIGINT");
        this.chromeProcess = undefined;
      } else {
        resolve();
      }
    });
  }

}

module.exports = HarCaptureEngine;
