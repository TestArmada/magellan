/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const Settings = require("../../../src/reporters/screenshot_aggregator/settings");

describe("ScreenshotAggregator Settings", () => {
  it("should initialize", () => {
    expect(Settings.hasOwnProperty("aggregatorURL")).to.be.true;
  });
});
