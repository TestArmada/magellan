/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const cliHelp = require("../src/cli_help");

describe("cliHelp", () => {
  it("should return default help", () => {
    cliHelp.help({
      console: {
        log: () => {}
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

  it("should return default help without example", () => {
    cliHelp.help({
      console: {
        log: () => {}
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

  it("should return default help with no help key", () => {
    cliHelp.help({
      console: {
        log: () => {}
      },
      settings: {
        testFramework: {
        }
      }
    });
    expect(cliHelp.help).to.exist;
  });

  it("should return default help with no help keys", () => {
    cliHelp.help({
      console: {
        log: () => {}
      },
      settings: {
      }
    });
    expect(cliHelp.help).to.exist;
  });
});
