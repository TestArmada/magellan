/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const Reporter = require("../../src/reporters/reporter");

describe("Reporter", () => {
  it("should be a listener", () => {
    const r = new Reporter();
    expect(r.initialize).to.not.be.null;
    expect(r.listenTo).to.not.be.null;
    expect(r.flush).to.not.be.null;
  });
});
