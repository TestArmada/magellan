/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const Settings = require("../../../src/reporters/slack/settings");

describe("Slack Settings", () => {
  it("should initialize", () => {
    expect(Settings.hasOwnProperty("enabled")).to.be.true;
  });
});
