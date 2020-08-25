/* eslint no-undef: 0 */
"use strict";

const settings = require("../src/settings");
const testFilter = require("../src/test_filter");

jest.mock("../src/settings", () => {
  return {
    testFramework: {
      iterator: () => ["a", "b", "c"],
      filters: {
        a: () => true,
        b: () => true
      }
    }
  };
});

describe("test_filter", () => {
  test("should filter from settings", () => {
    const tests = testFilter.filter(["a", "b", "c"], {
      a: () => true,
      b: () => true
    });

    expect(tests).toEqual(true);
  });

  test("should detect from cli", () => {
    const filters = testFilter.detectFromCLI({ a: "abcdefg" });

    expect(filters).toEqual({ a: "abcdefg" });
  });
});
