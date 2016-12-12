/* eslint no-undef: 0 */
"use strict";
var expect = require("chai").expect;
var testFilter = require("../src/test_filter");

describe("test_filter", function () {
  it("should filter", function () {
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
              a: function () { return true; },
              b: function () { return false; }
            }
          }
        }
      }
    )).to.eql(false);
  });

  it("should filter to true", function () {
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

  it("should detectFromCLI", function () {
    expect(testFilter.detectFromCLI(
      {
        a: true,
        b: true
      },
      {
        settings: {
          testFramework: {
            filters: {
              a: function () {},
              c: function () {}
            }
          }
        }
      }
    )).to.eql({a: true});
  });
});
