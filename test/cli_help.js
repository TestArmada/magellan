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
          },
          "another-visible-command": {
            "category": "Usability",
            "description": "FAKE_ANOTHER_VISIBLE_DES"
          }
        }
      }
    },
    framework: "FAKE_FRAME_NAME",
    testFramework: {
      help: {
        tags: {
          example: "tag1,tag2",
          visible: true,
          description: "Run all tests that match a list of comma-delimited tags (eg: tag1,tag2)"
        },
        group: {
          example: "prefix/path",
          description: "Run all tests that match a path prefix like ./tests/smoke"
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
