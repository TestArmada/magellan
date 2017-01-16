/* eslint no-undef: 0 */
"use strict";
const expect = require("chai").expect;
const testFilter = require("../src/test_filter");

describe("test_filter", () => {
  it("should filter", () => {
    expect(testFilter.filter(
      ["a", "b", "c"],
      {
        a: true,
        b: true
      },
      {
        settings: {
          testFramework: {
            filters: {
              a: () => { return true; },
              b: () => { return false; }
            }
          }
        }
      }
    )).to.eql(false);
  });

  it("should filter to true", () => {
    expect(testFilter.filter(
      ["a", "b", "c"],
      {
        a: true,
        b: true
      },
      {
        settings: {
          testFramework: {
            filters: {
            }
          }
        }
      }
    )).to.eql([ "a", "b", "c" ]);
  });

  it("should detectFromCLI", () => {
    expect(testFilter.detectFromCLI(
      {
        a: true,
        b: true
      },
      {
        settings: {
          testFramework: {
            filters: {
              a: () => {},
              c: () => {}
            }
          }
        }
      }
    )).to.eql({a: true});
  });
});
