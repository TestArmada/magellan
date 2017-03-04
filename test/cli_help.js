"use strict";

const chai = require("chai");
const chaiAsPromise = require("chai-as-promised");

const help = require("../src/cli_help");

chai.use(chaiAsPromise);

const expect = chai.expect;
const assert = chai.assert;

const opts = {
  settings: {
    testExecutors: {
      "sauce": {
        name: "FAKE_EXE_NAME",
        help: {
          "visible-command": {
            "category": "Usability",
            "visible": true,
            "description": "FAKE_VISIBLE_DES"
          },
          "invisible-command": {
            "category": "Usability",
            "visible": false,
            "description": "FAKE_INVISIBLE_DES"
          }
        }
      }
    }
  }
};

describe("cli_help", () => {
  it("print executors", () => {
    help.help(opts);
  });
});
