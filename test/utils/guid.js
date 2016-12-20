/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
var expect = require("chai").expect;
var guid = require("../../src/util/guid");

describe("guid", function () {
  it("should create a guid", function () {
    expect(guid()).to.not.be.null;
  });
});
