/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const main = require("../src/main");

describe("main", () => {
  it("should have stuff", () => {
    expect(main.Reporter).to.not.be.null;
    expect(main.portUtil).to.not.be.null;
  });
});
