/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const guid = require("../../src/util/guid");

describe("guid", () => {
  it("should create a guid", () => {
    expect(guid()).to.not.be.null;
  });
});
