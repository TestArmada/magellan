/* eslint no-undef: 0, no-unused-expressions: 0, no-throw-literal: 0 */
"use strict";

const loadRelativeModule = require("../../src/util/load_relative_module");

class T { }

describe("loadRelativeModule", () => {
  test("should load by name", () => {
    const mod = loadRelativeModule("foo", false, {
      require: (m) => T
    });

    expect(mod).toEqual(new T());
  });

  test("should load relatively", () => {
    const mod = loadRelativeModule("./foo", false, {
      require: (m) => T
    });

    expect(mod).toEqual(new T());
  });

  test("should fail with non-optional module not found", () => {
    try {
      loadRelativeModule("foo.js", false, {
        require: () => {
          throw { code: "MODULE_NOT_FOUND" };
        }
      });
      fail();
    } catch (e) {
      expect(e).not.toBeNull();
    }
  });

  test("should fail with undefined error code", () => {
    try {
      loadRelativeModule("foo.js", true, {
        require: () => {
          throw { code: undefined };
        }
      });
      fail();
    } catch (e) {
      expect(e).not.toBeNull();
    }
  });

  // test('should fail with optional', () => {
  //   const mod = loadRelativeModule('foo.js', true, {
  //     require: () => {
  //       throw { code: 'MODULE_NOT_FOUND' };
  //     }
  //   });
  //   expect(mod).toBeNull();
  // });

  test("should not throw error with optional module not found", () => {
    const mod = loadRelativeModule("foo.js", true, {
      require: () => {
        throw { code: "MODULE_NOT_FOUND" };
      }
    });
    expect(mod).toBeNull();
  });
});
