/* eslint no-undef: 0, no-unused-expressions: 0, no-throw-literal: 0 */
"use strict";
var expect = require("chai").expect;
var loadRelativeModule = require("../../src/util/load_relative_module");

describe("loadRelativeModule", function () {
  it("should load by name", function () {
    var mod = loadRelativeModule("foo", false, {
      require: function () {
        return function () {
          return "foo!";
        };
      }
    });
    expect(mod).not.to.be.null;
    expect(mod).not.to.eql("foo!");
  });

  it("should load relatively", function () {
    var mod = loadRelativeModule("./foo.js", false, {
      require: function () {
        return function () {
          return "foo!";
        };
      }
    });
    expect(mod).not.to.be.null;
    expect(mod).not.to.eql("foo!");
  });

  it("should fail", function () {
    var thrown = false;
    try {
      loadRelativeModule("foo.js", false, {
        require: function () {
          throw {code: "MODULE_NOT_FOUND"};
        },
        console: {
          error: function () {}
        }
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.not.be.null;
  });

  it("should fail with optional", function () {
    var mod = loadRelativeModule("foo.js", true, {
      require: function () {
        throw {code: "MODULE_NOT_FOUND"};
      },
      console: {
        error: function () {}
      }
    });
    expect(mod).to.be.null;
  });
});
