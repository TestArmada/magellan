/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const logstamp = require("../../src/util/logstamp");

describe("logstamp", () => {
  it("should create a logstamp", () => {
    expect(logstamp()).to.not.be.null;
  });
});
