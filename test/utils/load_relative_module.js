/* eslint no-undef: 0, no-unused-expressions: 0, no-throw-literal: 0 */
"use strict";
const expect = require("chai").expect;
const loadRelativeModule = require("../../src/util/load_relative_module");

class TestClass {
}

describe("loadRelativeModule", () => {
  it("should load by name", () => {
    const mod = loadRelativeModule("foo", false, {
      require: () => {
        return TestClass;
      }
    });
    expect(mod).not.to.be.null;
    expect(mod).not.to.eql("foo!");
  });

  it("should load relatively", () => {
    const mod = loadRelativeModule("./foo.js", false, {
      require: () => {
        return TestClass;
      }
    });
    expect(mod).not.to.be.null;
    expect(mod).not.to.eql("foo!");
  });

  it("should fail with non-optional module not found", () => {
    let thrown = false;
    try {
      loadRelativeModule("foo.js", false, {
        require: () => {
          throw {code: "MODULE_NOT_FOUND"};
        },
        console: {
          error: () => {}
        }
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.not.be.null;
  });

  it("should fail with undefined error code", () => {
    let thrown = false;
    try {
      loadRelativeModule("foo.js", true, {
        require: () => {
          throw {code: undefined};
        },
        console: {
          error: () => {}
        }
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.not.be.null;
  });

  it("should fail with optional", () => {
    const mod = loadRelativeModule("foo.js", true, {
      require: () => {
        throw {code: "MODULE_NOT_FOUND"};
      },
      console: {
        error: () => {}
      }
    });
    expect(mod).to.be.null;
  });

  it("should not throw error with optional module not found", () => {
    let thrown = false;
    try {
      loadRelativeModule("foo.js", true, {
        require: () => {
          throw {code: "MODULE_NOT_FOUND"};
        },
        console: {
          error: () => {}
        }
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.false;
  });

});
