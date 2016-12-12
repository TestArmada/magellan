/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
var expect = require("chai").expect;
var cliHelp = require("../src/cli_help");

describe("cliHelp", function () {
  it("should return default help", function () {
    cliHelp.help({
      console: {
        log: function () {}
      },
      settings: {
        testFramework: {
          help: {
            foobar: {
              example: "baz",
              description: "d"
            }
          }
        }
      }
    });
    expect(cliHelp.help).to.exist;
  });

  it("should return default help without example", function () {
    cliHelp.help({
      console: {
        log: function () {}
      },
      settings: {
        testFramework: {
          help: {
            foobar: {
              description: "d"
            }
          }
        }
      }
    });
    expect(cliHelp.help).to.exist;
  });

  it("should return default help with no help key", function () {
    cliHelp.help({
      console: {
        log: function () {}
      },
      settings: {
        testFramework: {
        }
      }
    });
    expect(cliHelp.help).to.exist;
  });

  it("should return default help with no help keys", function () {
    cliHelp.help({
      console: {
        log: function () {}
      },
      settings: {
      }
    });
    expect(cliHelp.help).to.exist;
  });
});
