/* eslint no-undef: 0 */
"use strict";
const expect = require("chai").expect;
const getTests = require("../src/get_tests");

describe("getTests", () => {
  it("should get tests", () => {
    expect(getTests({
      a: () => true,
      b: () => true
    }, {
      settings: {
        testFramework: {
          iterator: () => ["a", "b", "c"],
          filters: {
            a: () => true,
            b: () => true
          }
        }
      }
    })).to.eql(true);
  });
});
