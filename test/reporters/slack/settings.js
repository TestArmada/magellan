/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
var expect = require("chai").expect;
var Settings = require("../../../src/reporters/slack/settings");

describe("Slack Settings", function () {
  it("should initialize", function () {
    expect(Settings.hasOwnProperty("enabled")).to.be.true;
  });
});
